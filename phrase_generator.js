// Проверяем, не определен ли уже класс
if (!window.PhraseGenerator) {
    class PhraseGenerator {
        constructor() {
            this.phrases = [];
            this.currentIndex = 0;
            this.loadPhrases();
        }

        async loadPhrases() {
            try {
                const response = await fetch('brainwallet_phrases_password_leet_v1.1.json');
                const data = await response.json();
                this.phrases = data.map(item => item.passphrase);
                console.log(`Loaded ${this.phrases.length} phrases`);
            } catch (error) {
                console.error('Error loading phrases:', error);
                // Fallback to basic phrases if JSON load fails
                this.phrases = [
                    "test", "password", "123456", "qwerty",
                    "bitcoin", "satoshi", "blockchain"
                ];
            }
        }

        generatePhrases(count) {
            const result = [];
            for (let i = 0; i < count; i++) {
                if (this.currentIndex >= this.phrases.length) {
                    this.currentIndex = 0; // Start over if we've used all phrases
                }
                result.push(this.phrases[this.currentIndex++]);
            }
            return result;
        }
    }

    // Make it available globally only if not already defined
    window.PhraseGenerator = PhraseGenerator;
} 