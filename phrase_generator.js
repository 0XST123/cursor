// Проверяем, не определен ли уже класс
if (!window.PhraseGenerator) {
    class PhraseGenerator {
        constructor() {
            this.templates = null;
            this.phrases = [];
            this.currentIndex = 0;
            this.initialized = false;
            this.initPromise = this.loadTemplates();
        }

        async loadTemplates() {
            try {
                const response = await fetch('brainwallet_phrases_v2.json');
                this.templates = await response.json();
                console.log('Loaded phrase templates');
                this.initialized = true;
            } catch (error) {
                console.error('Error loading templates:', error);
                // Fallback to basic phrases if JSON load fails
                this.phrases = [
                    "test", "password", "123456", "qwerty",
                    "bitcoin", "satoshi", "blockchain"
                ];
                this.initialized = true;
            }
        }

        getRandomElement(array) {
            return array[Math.floor(Math.random() * array.length)];
        }

        applyLeet(word) {
            if (!this.templates || Math.random() > 0.3) return word; // 30% шанс применения leet
            
            return word.split('').map(char => {
                const leet = this.templates.leetMap[char.toLowerCase()];
                return leet && Math.random() > 0.5 ? leet : char;
            }).join('');
        }

        generatePhrase() {
            if (!this.templates) {
                return this.phrases[this.currentIndex % this.phrases.length];
            }

            const pattern = this.getRandomElement(this.templates.patterns);
            const parts = pattern.split('_');
            
            const generated = parts.map(part => {
                switch (part) {
                    case 'prefix':
                        return this.getRandomElement(this.templates.prefixes);
                    case 'word':
                        return this.getRandomElement(this.templates.words);
                    case 'year':
                        return this.getRandomElement(this.templates.years);
                    case 'number':
                        return this.getRandomElement(this.templates.numbers);
                    default:
                        return part;
                }
            });

            // Применяем leet к словам
            const phrase = generated.map(word => this.applyLeet(word)).join('_');
            
            // 20% шанс изменения регистра
            if (Math.random() > 0.8) {
                return Math.random() > 0.5 ? phrase.toUpperCase() : phrase.toLowerCase();
            }

            return phrase;
        }

        async generatePhrases(count) {
            // Ждем загрузки шаблонов, если они еще не загружены
            if (!this.initialized) {
                await this.initPromise;
            }

            const result = [];
            for (let i = 0; i < count; i++) {
                result.push(this.generatePhrase());
                this.currentIndex++;
            }
            return result;
        }
    }

    // Make it available globally only if not already defined
    window.PhraseGenerator = PhraseGenerator;
} 