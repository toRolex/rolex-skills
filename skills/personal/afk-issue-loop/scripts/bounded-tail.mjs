// Extracted from mattpocock/sandcastle e99f832f26dc9d245c019a9ddd19fa5dee792427.
// MIT, Copyright (c) 2026 Matt Pocock. Keep LICENSE.sandcastle with this file.
// src/boundedTail.ts:20-69; TypeScript annotations removed, algorithm unchanged.
export const MAX_TAIL_CHARS = 64 * 1024;
export class BoundedTail {
    items = [];
    totalChars = 0;
    maxChars;
    separator;
    constructor(maxChars = MAX_TAIL_CHARS, separator = ""){
        this.maxChars = maxChars;
        this.separator = separator;
    }
    push(item) {
        const bounded = item.length > this.maxChars ? item.slice(item.length - this.maxChars) : item;
        this.totalChars += bounded.length + (this.items.length > 0 ? this.separator.length : 0);
        this.items.push(bounded);
        while(this.totalChars > this.maxChars && this.items.length > 1){
            const dropped = this.items.shift();
            this.totalChars -= dropped.length + this.separator.length;
        }
    }
    toString() {
        return this.items.join(this.separator);
    }
}
