class WalletFinder {
    constructor() {
        // Initialize components
        this.wallet = new BitcoinWallet();
        this.phraseGenerator = new PhraseGenerator();
        this.api = BitcoinAPIFactory.createAPI();
        
        // Batch settings
        this.batchSize = 20;
        this.currentBatch = {
            number: 1,
            keys: [],
            progress: 0,
            processed: 0
        };
        
        // Statistics
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0
        };
        
        this.checkedCount = 0;
        this.foundCount = 0;
        this.totalBtcFound = 0;
        this.startTime = null;
        this.isRunning = false;

        // Initialize UI
        this.initializeUI();
        
        console.log('WalletFinder initialized');
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
            this.historyBody = document.getElementById('historyBody');

            // Batch info elements
            this.batchNumberElement = document.getElementById('batchNumber');
            this.batchProgressElement = document.getElementById('batchProgress');

            // Wallet type stats elements
            this.newCountElement = document.getElementById('newCount');
            this.usedCountElement = document.getElementById('usedCount');
            this.valuableCountElement = document.getElementById('valuableCount');

            if (!this.startButton || !this.stopButton) {
                throw new Error('Required UI elements not found');
            }

            // Add event listeners
            this.startButton.addEventListener('click', () => this.start());
            this.stopButton.addEventListener('click', () => this.stop());

            // Add auto-save on page unload
            window.addEventListener('beforeunload', () => this.saveState());
            
            // Try to restore previous state after UI is initialized
            this.restoreState();
            
        } catch (error) {
            console.error('Error initializing UI:', error);
            throw error;
        }
    }

    updateStats() {
        // Update general stats
        this.checkedCountElement.textContent = this.checkedCount;
        this.foundAddressCountElement.textContent = this.foundCount;
        this.foundBtcAmountElement.textContent = this.totalBtcFound.toFixed(8) + ' BTC';
        
        // Calculate and update speed
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        const speed = (this.checkedCount / elapsedSeconds).toFixed(2);
        this.speedElement.textContent = speed;
        
        // Update batch information
        this.batchNumberElement.textContent = this.currentBatch.number;
        this.batchProgressElement.textContent = `${Math.round(this.currentBatch.progress)}%`;
        
        // Update wallet type counts
        this.newCountElement.textContent = this.stats.new;
        this.usedCountElement.textContent = this.stats.used;
        this.valuableCountElement.textContent = this.stats.valuable;
        
        // Update progress bar
        this.progressBar.style.width = `${this.currentBatch.progress}%`;
        
        // Update API limit if available
        const requestsLeft = this.api.getRequestsLeft();
        if (requestsLeft !== Infinity) {
            this.apiLimitElement.textContent = requestsLeft;
        }
    }

    // Save current state including history
    saveState() {
        const state = {
            currentBatch: this.currentBatch,
            stats: this.stats,
            checkedCount: this.checkedCount,
            foundCount: this.foundCount,
            totalBtcFound: this.totalBtcFound,
            history: Array.from(this.historyBody.children).map(row => ({
                batchNumber: parseInt(row.cells[0].textContent),
                address: row.cells[1].textContent,
                privateKey: row.cells[2].textContent,
                balance: parseFloat(row.cells[3].textContent),
                status: row.cells[4].textContent,
                timestamp: row.cells[5].textContent
            }))
        };
        localStorage.setItem('walletFinderState', JSON.stringify(state));
    }

    // Restore previous state including history
    restoreState() {
        try {
            const savedState = localStorage.getItem('walletFinderState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.currentBatch = state.currentBatch;
                this.stats = state.stats;
                this.checkedCount = state.checkedCount;
                this.foundCount = state.foundCount;
                this.totalBtcFound = state.totalBtcFound;

                // Restore history
                if (state.history) {
                    this.historyBody.innerHTML = '';
                    state.history.forEach(item => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${item.batchNumber}</td>
                            <td>${item.address}</td>
                            <td>${item.privateKey}</td>
                            <td class="balance-column">${parseFloat(item.balance).toFixed(8)} BTC</td>
                            <td class="status-${item.status.toLowerCase()}">${item.status}</td>
                            <td>${item.timestamp}</td>
                        `;
                        this.historyBody.appendChild(row);
                    });
                }

                this.updateStats();
            }
        } catch (error) {
            console.error('Error restoring state:', error);
            // If restore fails, reset to initial state
            this.resetState();
        }
    }

    resetState() {
        this.currentBatch = {
            number: 1,
            keys: [],
            progress: 0,
            processed: 0
        };
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0
        };
        this.checkedCount = 0;
        this.foundCount = 0;
        this.totalBtcFound = 0;
        this.resultsBody.innerHTML = '';
        this.updateStats();
    }

    async start() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            this.startTime = Date.now();
            this.startButton.disabled = true;
            this.stopButton.disabled = false;

            // Clear only the results table
            this.resultsBody.innerHTML = '';

            while (this.isRunning) {
                try {
                    await this.processNextBatch();
                } catch (error) {
                    console.error('Error in main loop:', error);
                    if (error.message === 'API limit reached' || error.message === 'API request timeout') {
                        this.stop();
                        alert(error.message === 'API limit reached' ? 
                            'Достигнут лимит API запросов. Поиск остановлен.' :
                            'Превышено время ожидания API. Поиск остановлен.');
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

    getWalletStatus(addressInfo) {
        // Если баланс >= 0.0001 BTC
        if (addressInfo.balance >= 0.0001) {
            return {
                type: 'valuable',
                text: `Баланс: ${addressInfo.balance.toFixed(8)} BTC`
            };
        }

        // Если нет транзакций - новый адрес
        if (addressInfo.transactionCount === 0) {
            return {
                type: 'new',
                text: 'Новый'
            };
        }

        // Если есть транзакции - использованный адрес
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

    addToHistory(data) {
        // Проверяем, не существует ли уже такой адрес в истории
        const existingRows = Array.from(this.historyBody.children);
        const isDuplicate = existingRows.some(row => 
            row.cells[1].textContent === data.address
        );

        if (isDuplicate) {
            return;
        }

        const row = document.createElement('tr');
        if (data.balance > 0) {
            row.classList.add('has-balance');
        }
        
        row.innerHTML = `
            <td>${data.batchNumber}</td>
            <td>${data.address}</td>
            <td>${data.privateKey}</td>
            <td class="balance-column">${data.balance.toFixed(8)} BTC</td>
            <td class="status-${data.status.type}">${data.status.text}</td>
            <td>${new Date(data.timestamp).toLocaleString()}</td>
        `;
        
        this.historyBody.appendChild(row);
    }

    async processNextBatch() {
        // Generate new batch if needed
        if (this.currentBatch.keys.length === 0) {
            const phrases = this.phraseGenerator.generatePhrases(this.batchSize);
            this.currentBatch.keys = phrases.map(phrase => this.wallet.generateWallet(phrase));
            this.currentBatch.processed = 0;
            this.currentBatch.progress = 0;
            console.log(`Generated new batch #${this.currentBatch.number} with ${this.currentBatch.keys.length} keys`);
        }

        // Process current batch
        for (const walletData of this.currentBatch.keys) {
            if (!this.isRunning) break;

            try {
                const address = walletData.addresses.compressed;
                const addressInfo = await this.api.checkAddress(address);
                this.checkedCount++;
                this.currentBatch.processed++;
                
                // Get wallet status and update stats
                const status = this.getWalletStatus(addressInfo);
                this.stats[status.type]++;
                
                // Update batch progress
                this.currentBatch.progress = (this.currentBatch.processed / this.batchSize) * 100;
                
                // Add to main table
                this.addResultToTable({
                    address: address,
                    privateKey: walletData.privateKey
                }, {
                    balance: addressInfo.balance,
                    status: status
                });

                // Add to history if valuable or used
                if (status.type !== 'new') {
                    this.foundCount++;
                    this.totalBtcFound += addressInfo.balance;
                    
                    this.addToHistory({
                        batchNumber: this.currentBatch.number,
                        address: address,
                        privateKey: walletData.privateKey,
                        balance: addressInfo.balance,
                        status: status,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Update UI
                this.updateStats();
                await this.updateApiLimit();
                
            } catch (error) {
                console.error('Error processing address:', error);
                if (error.message === 'API limit reached' || error.message === 'API request timeout') {
                    throw error;
                }
            }
        }

        // Clear batch and prepare for next one
        console.log(`Batch #${this.currentBatch.number} completed`);
        this.resultsBody.innerHTML = ''; // Clear results table
        this.currentBatch.number++; // Increment batch number
        this.currentBatch.keys = []; // Clear keys
        this.currentBatch.processed = 0; // Reset processed count
        this.currentBatch.progress = 0; // Reset progress
        this.saveState(); // Save state after batch completion
    }

    async updateApiLimit() {
        const requestsLeft = this.api.getRequestsLeft();
        if (requestsLeft !== Infinity) {
            this.apiLimitElement.textContent = requestsLeft;
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