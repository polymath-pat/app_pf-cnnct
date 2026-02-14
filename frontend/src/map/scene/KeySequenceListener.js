export class KeySequenceListener {
    buffer = [];
    sequences = [];
    constructor() {
        this.sequences = [
            {
                name: 'konami',
                pattern: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
                callback: null,
            },
            {
                name: 'dove',
                pattern: ['d', 'o', 'v', 'e'],
                callback: null,
            },
            {
                name: 'tears',
                pattern: ['t', 'e', 'a', 'r', 's'],
                callback: null,
            },
        ];
    }
    setCallback(name, cb) {
        const seq = this.sequences.find(s => s.name === name);
        if (seq)
            seq.callback = cb;
    }
    handleKeyDown(event) {
        this.buffer.push(event.key);
        if (this.buffer.length > 20) {
            this.buffer.splice(0, this.buffer.length - 20);
        }
        for (const seq of this.sequences) {
            if (seq.callback && this.matches(seq.pattern)) {
                seq.callback();
                // Clear buffer after match to prevent re-triggering
                this.buffer.length = 0;
                break;
            }
        }
    }
    matches(pattern) {
        if (this.buffer.length < pattern.length)
            return false;
        const tail = this.buffer.slice(this.buffer.length - pattern.length);
        return tail.every((key, i) => {
            const p = pattern[i];
            // Arrow keys are case-sensitive (ArrowUp etc.), letters compared case-insensitively
            if (p.startsWith('Arrow'))
                return key === p;
            return key.toLowerCase() === p.toLowerCase();
        });
    }
}
