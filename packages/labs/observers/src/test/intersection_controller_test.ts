/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  ReactiveElement,
  PropertyValues,
  ReactiveControllerHost,
} from '@lit/reactive-element';
import {
  IntersectionController,
  IntersectionControllerConfig,
} from '../intersection_controller';
import {generateElementName, nextFrame} from './test-helpers';
import {assert} from '@esm-bundle/chai';

// Note, since tests are not built with production support, detect DEV_MODE
// by checking if warning API is available.
const DEV_MODE = !!ReactiveElement.enableWarning;

if (DEV_MODE) {
  ReactiveElement.disableWarning?.('change-in-update');
}

// TODO: disable these tests until can figure out issues with Sauce Safari
// version. They do pass on latest Safari locally.
//(window.IntersectionObserver ? suite : suite.skip)
suite.skip('IntersectionController', () => {
  let container: HTMLElement;

  interface TestElement extends ReactiveElement {
    observer: IntersectionController;
    observerValue: unknown;
    resetObserverValue: () => void;
    changeDuringUpdate?: () => void;
  }

  const defineTestElement = (
    getControllerConfig: (
      host: ReactiveControllerHost
    ) => IntersectionControllerConfig
  ) => {
    class A extends ReactiveElement {
      observer: IntersectionController;
      observerValue: unknown;
      changeDuringUpdate?: () => void;
      constructor() {
        super();
        const config = getControllerConfig(this);
        this.observer = new IntersectionController(this, config);
      }

      override update(props: PropertyValues) {
        super.update(props);
        if (this.changeDuringUpdate) {
          this.changeDuringUpdate();
        }
      }

      override updated() {
        this.observerValue = this.observer.value;
      }

      resetObserverValue() {
        this.observer.value = this.observerValue = undefined;
      }
    }
    customElements.define(generateElementName(), A);
    return A;
  };

  const renderTestElement = async (Ctor: typeof HTMLElement) => {
    const el = new Ctor() as TestElement;
    container.appendChild(el);
    await intersectionComplete();
    return el;
  };

  const getTestElement = async (
    getControllerConfig: (
      host: ReactiveControllerHost
    ) => IntersectionControllerConfig = () => ({})
  ) => {
    const ctor = defineTestElement(getControllerConfig);
    const el = await renderTestElement(ctor);
    return el;
  };

  const intersectionComplete = async () => {
    await nextFrame();
    await nextFrame();
  };

  const intersectOut = (el: HTMLElement) => {
    el.style.position = 'absolute';
    el.style.left = el.style.top = '-10000px';
  };

  const intersectIn = (el: HTMLElement) => {
    el.style.position = 'absolute';
    el.style.left = el.style.top = '0px';
  };

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // Note, only the first test fails on chrome when using playwright.
  // Work around this by inserting 1 dummy test.
  test('dummy test: workaround for first test fails on chrome when using playwright', async () => {
    const el = await getTestElement();
    assert.ok(el);
  });

  test('can observe changes', async () => {
    const el = await getTestElement();

    // Reports initial change by default
    assert.isTrue(el.observerValue);

    // Reports change when not intersecting
    el.resetObserverValue();
    intersectOut(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change when intersecting
    el.resetObserverValue();
    intersectIn(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('can observe changes during update', async () => {
    const el = await getTestElement();
    el.resetObserverValue();
    el.changeDuringUpdate = () => intersectOut(el);
    el.requestUpdate();
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('skips initial changes when `skipInitial` is `true`', async () => {
    const el = await getTestElement(() => ({
      skipInitial: true,
    }));

    // Does not reports initial change when `skipInitial` is set
    assert.isUndefined(el.observerValue);

    // Reports subsequent attribute change when `skipInitial` is set
    el.resetObserverValue();
    intersectOut(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports another attribute change
    el.resetObserverValue();
    el.requestUpdate();
    await intersectionComplete();
    assert.isUndefined(el.observerValue);
    intersectIn(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('observation managed via connection', async () => {
    const el = await getTestElement(() => ({
      skipInitial: true,
    }));
    assert.isUndefined(el.observerValue);

    intersectOut(el);
    // Does not report change after element removed.
    el.remove();
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Does not report change after element re-connected
    container.appendChild(el);
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Reports change on mutation when element is connected
    el.resetObserverValue();
    intersectIn(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('can observe external element', async () => {
    const d = document.createElement('div');
    container.appendChild(d);
    const el = await getTestElement(() => ({
      target: d,
      skipInitial: true,
    }));
    assert.equal(el.observerValue, undefined);

    // Observe intersect out
    intersectOut(d);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
    el.resetObserverValue();

    // Observe intersect in
    intersectIn(d);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('can manage value via `callback`', async () => {
    const el = await getTestElement(() => ({
      callback: (entries: IntersectionObserverEntry[]) =>
        entries[0]?.isIntersecting,
    }));
    assert.isTrue(el.observerValue);
    el.resetObserverValue();

    // Intersect out
    intersectOut(el);
    await intersectionComplete();
    assert.isFalse(el.observerValue);

    // Intersect in
    el.resetObserverValue();
    await intersectionComplete();
    intersectIn(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('can call `observe` to observe element', async () => {
    const el = await getTestElement();
    el.resetObserverValue();
    const d1 = document.createElement('div');

    // Reports initial changes when observe called.
    el.observer.observe(d1);
    el.renderRoot.appendChild(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to observed target.
    el.resetObserverValue();
    intersectOut(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to configured target.
    el.resetObserverValue();
    intersectOut(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reset host
    intersectIn(el);
    await intersectionComplete();

    // Can observe another target
    el.resetObserverValue();
    const d2 = document.createElement('div');
    el.observer.observe(d2);
    el.renderRoot.appendChild(d2);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to new observed target.
    el.resetObserverValue();
    intersectOut(d2);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to configured target.
    el.resetObserverValue();
    intersectOut(el);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reset host
    intersectIn(el);
    await intersectionComplete();

    // Reports change to first observed target.
    el.resetObserverValue();
    intersectIn(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('can specifying target as `null` and call `observe` to observe element', async () => {
    const el = await getTestElement(() => ({
      target: null,
    }));
    el.resetObserverValue();
    const d1 = document.createElement('div');

    // Reports initial changes when observe called.
    el.observer.observe(d1);
    el.renderRoot.appendChild(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to observed target.
    el.resetObserverValue();
    intersectOut(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Can observe another target
    el.resetObserverValue();
    const d2 = document.createElement('div');
    el.observer.observe(d2);
    el.renderRoot.appendChild(d2);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to new observed target.
    el.resetObserverValue();
    intersectOut(d2);
    await intersectionComplete();
    assert.isTrue(el.observerValue);

    // Reports change to first observed target.
    el.resetObserverValue();
    intersectIn(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('observed target respects `skipInitial`', async () => {
    const el = await getTestElement(() => ({
      target: null,
      skipInitial: true,
    }));
    const d1 = document.createElement('div');
    el.renderRoot.appendChild(d1);
    await intersectionComplete();

    // Does not reports initial changes when observe called.
    el.observer.observe(d1);
    el.requestUpdate();
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Reports change to observed target.
    intersectOut(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });

  test('observed target not re-observed on connection', async () => {
    const el = await getTestElement(() => ({
      target: null,
      skipInitial: true,
    }));
    const d1 = document.createElement('div');
    el.renderRoot.appendChild(d1);
    el.observer.observe(d1);
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Does not report change when disconnected.
    el.requestUpdate();
    el.remove();
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Does not report change when re-connected
    container.appendChild(el);
    await intersectionComplete();
    assert.isUndefined(el.observerValue);
    intersectOut(d1);
    await intersectionComplete();
    assert.isUndefined(el.observerValue);

    // Can re-observe after connection, respecting `skipInitial`
    el.observer.observe(d1);
    await intersectionComplete();
    assert.isUndefined(el.observerValue);
    intersectIn(d1);
    await intersectionComplete();
    assert.isTrue(el.observerValue);
  });
});
