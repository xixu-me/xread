declare global {
  interface Window {
    waitForSelector(selectorText: string): Promise<Element | null>;
  }
}

export {};
