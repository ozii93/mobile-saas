/**
 * POS Cart In-Memory State
 * Manages shopping cart items, line adjustments, and reset for POS checkout
 */

import { PosCartLineItem, PosProductItem } from './types';

class PosCartStore {
  private items: PosCartLineItem[] = [];
  private listeners: Array<() => void> = [];

  public getItems(): PosCartLineItem[] {
    return [...this.items];
  }

  public getTotal(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  public getItemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  public addItem(product: PosProductItem, quantity = 1, notes?: string): void {
    const existingIndex = this.items.findIndex(
      (it) => it.product.id === product.id && it.notes === notes
    );

    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      const newQty = existing.quantity + quantity;
      this.items[existingIndex] = {
        ...existing,
        quantity: newQty,
        unit_price: product.selling_price,
        subtotal: newQty * product.selling_price,
      };
    } else {
      this.items.push({
        product,
        quantity,
        unit_price: product.selling_price,
        notes,
        subtotal: quantity * product.selling_price,
      });
    }

    this.notify();
  }

  public updateQuantity(index: number, quantity: number): void {
    if (index < 0 || index >= this.items.length) return;
    if (quantity <= 0) {
      this.items.splice(index, 1);
    } else {
      const item = this.items[index];
      this.items[index] = {
        ...item,
        quantity,
        subtotal: quantity * item.unit_price,
      };
    }
    this.notify();
  }

  public clearCart(): void {
    this.items = [];
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}

export const posCartStore = new PosCartStore();
