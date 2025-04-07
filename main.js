class WalletFinder {
    constructor() {
        try {
            console.log('Initializing WalletFinder...');
            this.api = BitcoinAPIFactory.createAPI();
            this.wallet = new BitcoinWallet();
            this.phraseGenerator = new PhraseGenerator();
            
            // Initialize UI elements
            this.isRunning = false;
            this.checkedCount = 0;
            this.foundCount = 0;
            this.totalBtcFound = 0;
            this.stats = {
                new: 0,
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
        console.log('Running tests...');
        
        // Test wallet generation
        this.testWalletGeneration();
        
        // Test API
        try {
            const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Bitcoin genesis address
            const balance = await this.api.checkAddress(testAddress);
            console.log('API test result:', { address: testAddress, balance: balance });
        } catch (error) {
            console.error('API test failed:', error);
        }
    }

    initializeUI() {
        console.log('Initializing UI...');
        try {
            // Get UI elements
            this.startButton = document.getElementById('startButton');
            this.stopButton = document.getElementById('stopButton');
            this.checkedCountElement = document.getElementById('checkedCount');
            this.foundAddressCountElement = document.getElementById('foundAddressCount');
            this.foundBtcAmountElement = document.getElementById('foundBtcAmount');
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
            this.totalBtcFound = 0;
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
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
        }
    }

    stop() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
    }

    getWalletStatus(balance) {
        // Если баланс не определен или произошла ошибка
        if (typeof balance === 'undefined' || balance === null) {
            return {
                type: 'invalid',
                text: 'Не валидный'
            };
        }

        // Если баланс равен 0
        if (balance === 0) {
            return {
                type: 'new',
                text: 'Новый'
            };
        }

        // Если баланс больше 0
        return {
            type: 'used',
            text: 'Использовался'
        };
    }

    addResultToTable(walletData, info) {
        const row = document.createElement('tr');
        
        // Проверяем, что баланс это число и больше 0
        const balance = Number(info.balance) || 0;
        if (balance > 0) {
            row.classList.add('has-balance');
        }
        
        row.innerHTML = `
            <td>${walletData.address}</td>
            <td>${walletData.privateKey}</td>
            <td class="balance-column">${balance.toFixed(8)} BTC</td>
            <td class="status-${info.status.type}">${info.status.text}</td>
        `;
        
        this.resultsBody.appendChild(row);
    }

    updateStats() {
        this.checkedCountElement.textContent = this.checkedCount;
        this.foundAddressCountElement.textContent = this.foundCount;
        this.foundBtcAmountElement.textContent = this.totalBtcFound.toFixed(8) + ' BTC';
        
        // Calculate and update speed
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        const speed = (this.checkedCount / elapsedSeconds).toFixed(2);
        this.speedElement.textContent = speed;
        
        // Update wallet type counts
        document.getElementById('newCount').textContent = this.stats.new;
        document.getElementById('valuableCount').textContent = this.stats.valuable;
        
        // Update API limit if available
        const requestsLeft = this.api.getRequestsLeft();
        if (requestsLeft !== Infinity) {
            this.apiLimitElement.textContent = requestsLeft;
        }
    }

    async processNextBatch() {
        const batchSize = 5;
        const phrases = this.phraseGenerator.generatePhrases(batchSize);
        
        for (const phrase of phrases) {
            if (!this.isRunning) break;

            const walletData = this.wallet.generateWallet(phrase);
            
            try {
                const balance = await this.api.checkAddress(walletData.address);
                this.checkedCount++;
                
                // Get wallet status and update stats
                const status = this.getWalletStatus(balance);
                this.stats[status.type]++;
                
                // Update stats
                this.foundCount++;
                this.totalBtcFound += balance;
                
                // Add to table
                this.addResultToTable(walletData, {
                    balance: balance,
                    status: status
                });
                
                // Update UI
                this.updateStats();
                await this.updateApiLimit();
                
            } catch (error) {
                console.error('Error processing address:', error);
                if (error.message === 'API limit reached') {
                    throw error;
                }
            }
        }
    }

    async updateApiLimit() {
        try {
            const limit = await this.api.getRequestsLeft();
            this.apiLimitElement.textContent = limit;
        } catch (error) {
            console.error('Error updating API limit:', error);
        }
    }

    testWalletGeneration() {
        const phrase = 'test phrase';
        const walletData = this.wallet.generateWallet(phrase);
        console.log('Wallet generation test result:', walletData);
    }
}

// Remove duplicate initialization
// Initialize the application when the page loads
// document.addEventListener('DOMContentLoaded', () => {
//     window.walletFinder = new WalletFinder();
// }); 