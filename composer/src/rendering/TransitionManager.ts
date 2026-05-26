export class TransitionManager {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById('screen-fade')!;
  }

  fadeOut(ms = 900): Promise<void> {
    return new Promise((resolve) => {
      this.el.classList.remove('hidden');
      this.el.style.transition = `opacity ${ms}ms ease-in`;
      this.el.style.opacity = '1';
      setTimeout(resolve, ms);
    });
  }

  fadeIn(ms = 900): Promise<void> {
    return new Promise((resolve) => {
      this.el.style.transition = `opacity ${ms}ms ease-out`;
      this.el.style.opacity = '0';
      setTimeout(() => {
        this.el.classList.add('hidden');
        resolve();
      }, ms);
    });
  }

  async runTransition(action: () => void | Promise<void>, fadeMs = 900): Promise<void> {
    await this.fadeOut(fadeMs);
    await action();
    await this.fadeIn(fadeMs);
  }
}
