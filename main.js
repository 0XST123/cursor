class WalletFinder {
    constructor() {
        console.log('Initializing WalletFinder...');
        try {
            this.api = new BlockchairAPI();
            this.wallet = new BitcoinWallet();
            this.phraseGenerator = new PhraseGenerator();
            
            this.isRunning = false;
            this.checkedCount = 0;
            this.foundCount = 0;
            this.stats = {
                invalid: 0,
                new: 0,
                empty: 0,
                positive: 0
            };
            this.walletTypeStats = {
                p2pkh: 0,  // Legacy
                p2sh: 0,   // SegWit
                bech32: 0, // Native SegWit
                p2tr: 0    // Taproot
            };
            this.startTime = null;
            
            this.initializeUI();
            console.log('WalletFinder initialized successfully');
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

            // Get wallet type statistics elements
            this.walletTypeElements = {
                p2pkh: document.getElementById('p2pkhCount'),
                p2sh: document.getElementById('p2shCount'),
                bech32: document.getElementById('bech32Count'),
                p2tr: document.getElementById('p2trCount')
            };

            if (!this.startButton || !this.stopButton || !this.walletTypeElements.p2pkh) {
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

        // Convert balance to BTC (from satoshis)
        const balanceBTC = (addressInfo.balance || 0) / 100000000;

        // Check for positive balance
        if (balanceBTC >= 0.00001) {
            return {
                type: 'positive',
                text: 'Положительный'
            };
        }

        // Check if it's a new address
        if (addressInfo.totalTransactions === 0) {
            return {
                type: 'new',
                text: 'Новый'
            };
        }

        // If has transactions but zero balance
        return {
            type: 'empty',
            text: 'Пустой'
        };
    }

    async processNextBatch() {
        const batchSize = 5;
        const phrases = this.phraseGenerator.generatePhrases(batchSize);
        
        for (const phrase of phrases) {
            if (!this.isRunning) break;

            const walletData = this.wallet.generateWallet(phrase);
            
            // Determine wallet type based on address prefix
            const address = walletData.address;
            if (address.startsWith('1')) {
                this.walletTypeStats.p2pkh++;
            } else if (address.startsWith('3')) {
                this.walletTypeStats.p2sh++;
            } else if (address.startsWith('bc1q')) {
                this.walletTypeStats.bech32++;
            } else if (address.startsWith('bc1p')) {
                this.walletTypeStats.p2tr++;
            }
            
            try {
                const addressInfo = await this.api.checkAddress(walletData.address);
                this.checkedCount++;
                
                // Get wallet status and update stats
                const status = this.getWalletStatus(addressInfo);
                this.stats[status.type]++;
                
                // Add to table
                this.addResultToTable(walletData, addressInfo, status);
                
                // Update found count for positive balances
                if (status.type === 'positive') {
                    this.foundCount++;
                }
                
                // Update stats after each address check
                await this.updateStats();
            } catch (error) {
                console.error('Error checking address:', error);
                // Count failed checks as invalid
                this.stats.invalid++;
                this.addResultToTable(walletData, null, { type: 'invalid', text: 'Не валидный' });
                throw error;
            }
        }
    }

    addResultToTable(walletData, info, status) {
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

        // Keep only last 50 results
        if (this.resultsBody.children.length > 50) {
            this.resultsBody.removeChild(this.resultsBody.lastChild);
        }
    }

    async updateStats() {
        // Update counts
        this.checkedCountElement.textContent = this.checkedCount;
        this.foundCountElement.textContent = this.foundCount;

        // Update speed
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        const speed = this.checkedCount / elapsedSeconds;
        this.speedElement.textContent = speed.toFixed(2);

        // Update API limit
        this.updateApiLimit();

        // Update progress bar
        const progress = (10000 - this.api.getRequestsLeft()) / 100;
        this.progressBar.style.width = `${progress}%`;

        // Update wallet type statistics
        for (const [type, count] of Object.entries(this.walletTypeStats)) {
            if (this.walletTypeElements[type]) {
                this.walletTypeElements[type].textContent = count;
            }
        }
    }

    updateApiLimit() {
        this.apiLimitElement.textContent = this.api.getRequestsLeft();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.walletFinder = new WalletFinder();
}); 