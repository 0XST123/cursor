class WalletFinder {
    constructor() {
        try {
            console.log('Initializing WalletFinder...');
            this.api = new BlockchairAPI();
            this.wallet = new BitcoinWallet();
            this.phraseGenerator = new PhraseGenerator();
            
            // Test cases
            const testCases = [
                // Наш предыдущий тестовый ключ
                '70ba928a1205b7a4ad61165c70ab07bfb638b0bddbd3e013e3f4a96d0d6c1d18',
                // Дополнительные тестовые ключи
                'f4128c0b67f6ce729db9b94da4e4c35f54822d9d0e1fd918f88a1c1870c17e1f',
                '8d4733ae5e1e0d2b2e9827c734947b54c3c1c2a81c45e3237f3e6dcb1d16f658'
            ];
            
            console.log('=== Testing Address Generation ===');
            testCases.forEach((privateKey, index) => {
                console.log(`\nTest Case ${index + 1}:`);
                console.log('Private Key:', privateKey);
                
                // Метод 1: Прямая генерация из приватного ключа
                const address1 = this.wallet.generateAddressFromPrivateKey(privateKey);
                console.log('Method 1 (Direct):', address1);
                
                // Метод 2: Через публичный ключ
                const publicKey = this.wallet.generatePublicKey(privateKey);
                const address2 = this.wallet.generateAddress(publicKey);
                console.log('Method 2 (Via Public Key):', address2);
                
                // Проверка валидности
                const validation = this.wallet.validateAddress(address1);
                console.log('Address Validation:', 
                    validation.isValid ? '✓ Valid' : '✗ Invalid',
                    `(${validation.format || validation.reason})`
                );
                
                // Проверка совпадения адресов
                console.log('Addresses Match:', address1 === address2 ? '✓ Yes' : '✗ No');
            });
            
            this.isRunning = false;
            this.checkedCount = 0;
            this.foundCount = 0;
            this.stats = {
                invalid: 0,
                new: 0,
                empty: 0,
                positive: 0
            };
            
            this.initializeUI();
            console.log('\nWalletFinder initialized successfully');
        } catch (error) {
            console.error('Error initializing WalletFinder:', error);
            throw error;
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
                    alert('API limit reached. Stopping search.');
                    break;
                }
            }
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
                throw error;
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
        
        // Calculate and update speed
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        const speed = Math.round(this.checkedCount / elapsedTime);
        this.speedElement.textContent = speed;
    }

    async updateApiLimit() {
        try {
            const limit = await this.api.getRemainingLimit();
            this.apiLimitElement.textContent = limit;
        } catch (error) {
            console.error('Error updating API limit:', error);
            this.apiLimitElement.textContent = 'Error';
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.walletFinder = new WalletFinder();
}); 