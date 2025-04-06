class WalletFinder {
    constructor() {
        try {
            console.log('Initializing WalletFinder...');
            this.api = new BlockchairAPI();
            this.wallet = new BitcoinWallet();
            this.phraseGenerator = new PhraseGenerator();
            
            // Initialize UI elements
            this.isRunning = false;
            this.checkedCount = 0;
            this.foundCount = 0;
            this.stats = {
                invalid: 0,
                new: 0,
                used: 0,
                valuable: 0
            };
            
            this.initializeUI();
            console.log('\nWalletFinder initialized successfully');
        } catch (error) {
            console.error('Error initializing WalletFinder:', error);
            throw new Error(`Ошибка инициализации WalletFinder: ${error.message}`);
        }
    }

    async runTests() {
        try {
            // Test cases
            const testCases = [
                // Известный использованный адрес
                '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF',
                // Наш тестовый ключ
                '70ba928a1205b7a4ad61165c70ab07bfb638b0bddbd3e013e3f4a96d0d6c1d18',
                // Тестовая фраза
                'satoshi nakamoto 2009'
            ];
            
            console.log('%c=== Starting Component Tests ===', 'color: blue; font-weight: bold');
            
            // 1. Test PhraseGenerator
            console.log('%c\n1. Testing PhraseGenerator:', 'color: green; font-weight: bold');
            const phrases = this.phraseGenerator.generatePhrases(3);
            phrases.forEach((phrase, i) => {
                console.log(`%c  Phrase ${i + 1}: ${phrase}`, 'color: black');
            });
            
            // 2. Test BitcoinWallet
            console.log('%c\n2. Testing BitcoinWallet:', 'color: green; font-weight: bold');
            
            // Test address validation
            console.log('%c  2.1. Address Validation Test:', 'color: purple');
            const addressValidation = this.wallet.validateAddress(testCases[0]);
            console.log('    Known Address:', testCases[0]);
            console.log('    Validation Result:', addressValidation);
            
            // Test private key validation
            console.log('%c  2.2. Private Key Test:', 'color: purple');
            const keyValidation = this.wallet.validatePrivateKey(testCases[1]);
            console.log('    Test Key:', testCases[1].substring(0, 8) + '...');
            console.log('    Validation Result:', keyValidation);
            
            // Test wallet generation from phrase
            console.log('%c  2.3. Wallet Generation Test:', 'color: purple');
            const testWallet = this.wallet.generateWallet(testCases[2]);
            console.log('    From Phrase:', testCases[2]);
            console.log('    Generated Wallet:', {
                phrase: testWallet.phrase,
                privateKey: testWallet.privateKey.substring(0, 8) + '...',
                publicKey: testWallet.publicKey.substring(0, 8) + '...',
                address: testWallet.address
            });
            
            // 3. Test BlockchairAPI
            console.log('%c\n3. Testing BlockchairAPI:', 'color: green; font-weight: bold');
            console.log('  Checking known address:', testCases[0]);
            const apiResponse = await this.api.checkAddress(testCases[0]);
            console.log('  API Response:', apiResponse);
            
            console.log('%c\n=== All tests completed successfully ===', 'color: blue; font-weight: bold');
            return true;
        } catch (error) {
            console.error('%cTest execution failed:', 'color: red; font-weight: bold', error);
            return false;
        }
    }

    initializeUI() {
        console.log('Initializing UI...');
        try {
            // Get UI elements
            this.startButton = document.getElementById('startButton');
            this.stopButton = document.getElementById('stopButton');
            this.checkedCountElement = document.getElementById('checkedCount');
            this.foundCountElement = document.getElementById('foundCount');
            this.speedElement = document.getElementById('speed');
            this.apiLimitElement = document.getElementById('apiLimit');
            this.progressBar = document.getElementById('progressBar');
            this.resultsBody = document.getElementById('resultsBody');

            if (!this.startButton || !this.stopButton) {
                throw new Error('Required UI elements not found');
            }

            // Add event listeners
            this.startButton.addEventListener('click', () => this.start());
            this.stopButton.addEventListener('click', () => this.stop());

            // Initialize API limit display
            this.updateApiLimit();
            console.log('UI initialized successfully');
        } catch (error) {
            console.error('Error initializing UI:', error);
            throw error;
        }
    }

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            this.startTime = Date.now();
            this.startButton.disabled = true;
            this.stopButton.disabled = false;

            // Clear previous results
            this.resultsBody.innerHTML = '';
            this.checkedCount = 0;
            this.foundCount = 0;
            Object.keys(this.stats).forEach(key => this.stats[key] = 0);

            while (this.isRunning) {
                try {
                    await this.processNextBatch();
                } catch (error) {
                    console.error('Error in main loop:', error);
                    if (error.message === 'API limit reached') {
                        this.stop();
                        alert('Достигнут лимит API запросов. Поиск остановлен.');
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Critical error in start:', error);
            alert(`Критическая ошибка: ${error.message}`);
        } finally {
            // Ensure buttons are in correct state
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
        }
    }

    stop() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
    }

    getWalletStatus(addressInfo) {
        // Check if address is invalid
        if (!addressInfo || addressInfo.error) {
            return {
                type: 'invalid',
                text: 'Не валидный'
            };
        }

        // Check if it's a new address
        if (addressInfo.totalTransactions === 0) {
            return {
                type: 'new',
                text: 'Новый'
            };
        }

        // If has transactions
        return {
            type: 'used',
            text: 'Использовался'
        };
    }

    async processNextBatch() {
        const batchSize = 5;
        const phrases = this.phraseGenerator.generatePhrases(batchSize);
        
        for (const phrase of phrases) {
            if (!this.isRunning) break;

            const walletData = this.wallet.generateWallet(phrase);
            
            try {
                const addressInfo = await this.api.checkAddress(walletData.address);
                this.checkedCount++;
                
                // Get wallet status and update stats
                const status = this.getWalletStatus(addressInfo);
                this.stats[status.type]++;
                
                // Add to table
                this.addResultToTable(walletData, status);
                
                // Update found count for used addresses
                if (status.type === 'used') {
                    this.foundCount++;
                }
                
                // Update stats after each address check
                await this.updateStats();
            } catch (error) {
                console.error('Error checking address:', error);
                // Count failed checks as invalid
                this.stats.invalid++;
                this.addResultToTable(walletData, { type: 'invalid', text: 'Не валидный' });
                
                // Only stop if API limit is reached
                if (error.message === 'API limit reached') {
                    throw error;
                }
                
                // For other errors, continue with next phrase
                continue;
            }
        }
    }

    addResultToTable(walletData, status) {
        const row = document.createElement('tr');
        
        // Address cell with validation and copy button
        const addressCell = document.createElement('td');
        addressCell.className = 'address-cell';
        
        const addressValidation = this.wallet.validateAddress(walletData.address);
        const addressValidationSpan = document.createElement('span');
        addressValidationSpan.className = addressValidation.isValid ? 'valid-key' : 'invalid-key';
        addressValidationSpan.textContent = addressValidation.isValid ? '✓ ' : '✗ ';
        addressValidationSpan.title = addressValidation.isValid ? 
            `Валидный ${addressValidation.format} адрес` : 
            `Невалидный адрес: ${addressValidation.reason}`;
        
        const addressText = document.createElement('span');
        addressText.className = 'address-text';
        addressText.textContent = walletData.address;
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button tooltip';
        copyButton.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 24 24">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
        `;
        copyButton.onclick = () => {
            navigator.clipboard.writeText(walletData.address);
            copyButton.classList.add('copied');
            setTimeout(() => copyButton.classList.remove('copied'), 1000);
        };
        
        addressCell.appendChild(addressValidationSpan);
        addressCell.appendChild(addressText);
        addressCell.appendChild(copyButton);
        
        // Private key cell with validation status
        const privateKeyCell = document.createElement('td');
        privateKeyCell.className = 'private-key-cell';
        
        const validation = this.wallet.validatePrivateKey(walletData.privateKey);
        const validationSpan = document.createElement('span');
        validationSpan.className = validation.isValid ? 'valid-key' : 'invalid-key';
        validationSpan.textContent = validation.isValid ? '✓ ' : '✗ ';
        validationSpan.title = validation.isValid ? 
            'Валидный приватный ключ' : 
            `Невалидный ключ: ${validation.reason}`;
        
        const privateKeyText = document.createElement('span');
        privateKeyText.textContent = walletData.privateKey;
        
        privateKeyCell.appendChild(validationSpan);
        privateKeyCell.appendChild(privateKeyText);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.className = `status-${status.type}`;
        statusCell.textContent = status.text;
        
        // Add all cells to row
        row.appendChild(addressCell);
        row.appendChild(privateKeyCell);
        row.appendChild(statusCell);
        
        // Add row to table
        this.resultsBody.appendChild(row);

        // Keep only last 100 results
        while (this.resultsBody.children.length > 100) {
            this.resultsBody.removeChild(this.resultsBody.firstChild);
        }
    }

    updateStats() {
        // Update counters
        this.checkedCountElement.textContent = this.checkedCount;
        this.foundCountElement.textContent = this.foundCount;
        
        // Update wallet type counts
        document.getElementById('newCount').textContent = this.stats.new;
        document.getElementById('usedCount').textContent = this.stats.used;
        document.getElementById('valuableCount').textContent = this.stats.valuable;
        
        // Calculate and update speed
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        const speed = Math.round(this.checkedCount / elapsedTime);
        this.speedElement.textContent = speed;
        
        // Update API limit
        this.apiLimitElement.textContent = this.api.getRequestsLeft();
    }

    async updateApiLimit() {
        try {
            const limit = this.api.getRequestsLeft();
            this.apiLimitElement.textContent = limit;
        } catch (error) {
            console.error('Error updating API limit:', error);
            this.apiLimitElement.textContent = 'Error';
        }
    }

    // Test function to verify wallet generation
    testWalletGeneration() {
        try {
            console.log('Starting wallet generation test...');
            
            // Generate a test phrase
            const phraseGenerator = new PhraseGenerator();
            const phrase = phraseGenerator.generatePhrase();
            console.log('Generated test phrase:', phrase);
            
            // Generate wallet
            const wallet = this.wallet.generateWallet(phrase);
            console.log('Generated wallet:', {
                phrase: wallet.phrase,
                privateKey: wallet.privateKey.substring(0, 8) + '...',
                publicKey: wallet.publicKey.substring(0, 8) + '...',
                address: wallet.address
            });
            
            // Validate the generated address
            const validation = this.wallet.validateAddress(wallet.address);
            console.log('Address validation result:', validation);
            
            return {
                success: true,
                wallet: wallet,
                validation: validation
            };
        } catch (error) {
            console.error('Wallet generation test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Remove duplicate initialization
// Initialize the application when the page loads
// document.addEventListener('DOMContentLoaded', () => {
//     window.walletFinder = new WalletFinder();
// }); 