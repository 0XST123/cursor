class WalletFinder {
    constructor() {
        // Initialize components
        this.wallet = new BitcoinWallet();
        this.phraseGenerator = new PhraseGenerator();
        this.api = BitcoinAPIFactory.createAPI();
        
        // Batch settings
        this.batchSize = 100;
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
        this.pauseTime = null;
        this.totalPauseTime = 0;
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
            this.pauseButton = document.getElementById('pauseButton');
            this.reloadButton = document.getElementById('reloadButton');
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

            if (!this.startButton || !this.pauseButton || !this.reloadButton) {
                throw new Error('Required UI elements not found');
            }

            // Add event listeners
            this.startButton.addEventListener('click', () => this.start());
            this.pauseButton.addEventListener('click', () => this.pause());
            this.reloadButton.addEventListener('click', () => this.reload());

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
        // Check if all UI elements are available
        if (!this.checkedCountElement || !this.foundAddressCountElement || 
            !this.foundBtcAmountElement || !this.speedElement || 
            !this.batchNumberElement || !this.batchProgressElement ||
            !this.newCountElement || !this.usedCountElement ||
            !this.valuableCountElement || !this.progressBar ||
            !this.apiLimitElement) {
            console.error('UI elements not ready for stats update');
            return;
        }
        
        // Update general stats
        this.checkedCountElement.textContent = this.checkedCount;
        this.foundAddressCountElement.textContent = this.foundCount;
        this.foundBtcAmountElement.textContent = this.totalBtcFound.toFixed(8) + ' BTC';
        
        // Calculate and update speed
        if (this.startTime) {
            const currentTime = this.isRunning ? Date.now() : (this.pauseTime || Date.now());
            const effectiveTime = currentTime - this.startTime - this.totalPauseTime;
            const elapsedSeconds = effectiveTime / 1000;
            const speed = elapsedSeconds > 0 ? (this.checkedCount / elapsedSeconds).toFixed(2) : '0.00';
            this.speedElement.textContent = speed;
        } else {
            this.speedElement.textContent = '0.00';
        }
        
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

    saveState() {
        const state = {
            currentBatch: this.currentBatch,
            stats: this.stats,
            checkedCount: this.checkedCount,
            foundCount: this.foundCount,
            totalBtcFound: this.totalBtcFound,
            startTime: this.startTime,
            pauseTime: this.pauseTime,
            totalPauseTime: this.totalPauseTime,
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
                this.startTime = state.startTime;
                this.pauseTime = state.pauseTime;
                this.totalPauseTime = state.totalPauseTime || 0;

                // Restore history
                if (state.history) {
                    this.historyBody.innerHTML = '';
                    // Разворачиваем массив, чтобы сохранить порядок новые-сверху
                    [...state.history].reverse().forEach(item => {
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
        this.startTime = null;
        this.pauseTime = null;
        this.totalPauseTime = 0;
        this.resultsBody.innerHTML = '';
        this.updateStats();
    }

    reload() {
        // Clear main table
        this.resultsBody.innerHTML = '';
        
        // Reset statistics
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0
        };
        this.checkedCount = 0;
        this.foundCount = 0;
        this.totalBtcFound = 0;
        this.startTime = null;
        this.pauseTime = null;
        this.totalPauseTime = 0;
        
        // Reset batch
        this.currentBatch = {
            number: 1,
            keys: [],
            progress: 0,
            processed: 0
        };
        
        // Update UI
        this.updateStats();
        
        // Enable start button
        this.startButton.disabled = false;
        this.pauseButton.disabled = true;
        
        console.log('Application reloaded');
    }

    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.pauseTime = Date.now();
        this.startButton.disabled = false;
        this.pauseButton.disabled = true;
        
        // Сохраняем текущее состояние
        this.saveState();
        console.log(`Processing paused at batch #${this.currentBatch.number}, position ${this.currentBatch.processed}`);
    }

    async start() {
        if (this.isRunning) return;

        try {
            // Если есть незавершенная партия, продолжаем с текущей позиции
            if (this.currentBatch.keys.length > 0 && this.currentBatch.processed < this.batchSize) {
                console.log(`Resuming batch #${this.currentBatch.number} from position ${this.currentBatch.processed}`);
            }

            this.isRunning = true;
            
            // Обновляем время паузы при возобновлении
            if (this.pauseTime) {
                this.totalPauseTime += Date.now() - this.pauseTime;
                this.pauseTime = null;
            }
            
            // Инициализируем время старта, если это первый запуск
            if (!this.startTime) {
                this.startTime = Date.now();
                this.totalPauseTime = 0;
            }
            
            this.startButton.disabled = true;
            this.pauseButton.disabled = false;

            while (this.isRunning) {
                try {
                    await this.processNextBatch();
                } catch (error) {
                    console.error('Error in main loop:', error);
                    if (error.message === 'API limit reached' || error.message === 'API request timeout') {
                        this.pause();
                        alert(error.message === 'API limit reached' ? 
                            'Достигнут лимит API запросов. Поиск остановлен.' :
                            'Превышено время ожидания API. Поиск остановлен.');
                        break;
                    }
                }
                
                // Добавляем задержку между итерациями для возможности прерывания
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error('Critical error in start:', error);
            alert(`Критическая ошибка: ${error.message}`);
        }
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

    addResultToTable(walletData, checkResult, index) {
        const row = document.createElement('tr');
        if (checkResult.balance > 0) {
            row.classList.add('has-balance');
        }

        // Добавляем индекс для нумерации в текущем батче
        const displayIndex = this.currentBatch.number * this.batchSize - (this.batchSize - index - 1);
        
        // Создаем ячейки для обоих типов адресов
        row.innerHTML = `
            <td>${displayIndex}</td>
            <td>
                C: ${walletData.compressed.address}<br>
                U: ${walletData.uncompressed.address}
            </td>
            <td>${walletData.privateKey}</td>
            <td class="balance-column">${checkResult.balance.toFixed(8)} BTC</td>
            <td class="status-${checkResult.status.type}">${checkResult.status.text}</td>
        `;

        // Добавляем новую строку в начало таблицы
        if (this.resultsBody.firstChild) {
            this.resultsBody.insertBefore(row, this.resultsBody.firstChild);
        } else {
            this.resultsBody.appendChild(row);
        }
    }

    addToHistory(data) {
        // Проверяем, не существует ли уже такой адрес в истории
        const existingRows = Array.from(this.historyBody.children);
        const isDuplicate = existingRows.some(row => {
            const addresses = row.cells[1].textContent.split('\n');
            return addresses.includes(data.compressed.address) || 
                   addresses.includes(data.uncompressed.address);
        });

        if (isDuplicate) {
            return;
        }

        const row = document.createElement('tr');
        if (data.balance > 0) {
            row.classList.add('has-balance');
        }
        
        row.innerHTML = `
            <td>${data.batchNumber}</td>
            <td>
                C: ${data.compressed.address}<br>
                U: ${data.uncompressed.address}
            </td>
            <td>${data.privateKey}</td>
            <td class="balance-column">${data.balance.toFixed(8)} BTC</td>
            <td class="status-${data.status.type}">${data.status.text}</td>
            <td>${new Date(data.timestamp).toLocaleString()}</td>
        `;
        
        // Добавляем новую строку в начало таблицы
        if (this.historyBody.firstChild) {
            this.historyBody.insertBefore(row, this.historyBody.firstChild);
        } else {
            this.historyBody.appendChild(row);
        }
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
        for (let i = this.currentBatch.processed; i < this.currentBatch.keys.length; i++) {
            if (!this.isRunning) {
                console.log(`Processing stopped at position ${i}`);
                return;
            }

            try {
                const walletData = this.currentBatch.keys[i];
                
                // Проверяем оба адреса
                const compressedInfo = await this.api.checkAddress(walletData.compressed.address);
                const uncompressedInfo = await this.api.checkAddress(walletData.uncompressed.address);
                
                // Увеличиваем счетчик на 2, так как проверили 2 адреса
                this.checkedCount += 2;
                this.currentBatch.processed++;
                
                // Определяем статус и баланс (берем максимальный из двух адресов)
                const balance = Math.max(compressedInfo.balance, uncompressedInfo.balance);
                const status = this.getWalletStatus({ balance });
                this.stats[status.type]++;
                
                // Update batch progress
                this.currentBatch.progress = (this.currentBatch.processed / this.batchSize) * 100;
                
                // Add to main table with index
                this.addResultToTable(walletData, {
                    balance: balance,
                    status: status
                }, i);

                // Add to history if valuable or used
                if (status.type !== 'new') {
                    this.foundCount++;
                    this.totalBtcFound += balance;
                    
                    this.addToHistory({
                        batchNumber: this.currentBatch.number,
                        compressed: walletData.compressed,
                        uncompressed: walletData.uncompressed,
                        privateKey: walletData.privateKey,
                        balance: balance,
                        status: status,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Update UI
                this.updateStats();
                await this.updateApiLimit();
                
                // Добавляем небольшую задержку между проверками
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error processing wallet at position ${i}:`, error);
                // Continue with next wallet
                continue;
            }
        }

        // Batch completed
        if (this.currentBatch.processed >= this.currentBatch.keys.length) {
            console.log(`Batch #${this.currentBatch.number} completed`);
            this.currentBatch.number++;
            this.currentBatch.keys = [];
            this.currentBatch.processed = 0;
            this.currentBatch.progress = 0;
        }

        // Save state
        this.saveState();

        // Continue with next batch if running
        if (this.isRunning) {
            this.processNextBatch();
        }
    }

    async updateApiLimit() {
        const requestsLeft = this.api.getRequestsLeft();
        if (requestsLeft !== Infinity) {
            this.apiLimitElement.textContent = requestsLeft;
        }
    }

    testWalletGeneration() {
        console.log('Testing wallet generation...');
        
        // Test with a known phrase
        const testPhrase = 'test phrase';
        console.log('Test phrase:', testPhrase);
        
        // Generate wallet
        const walletData = this.wallet.generateWallet(testPhrase);
        
        // Log detailed results
        console.log('Generated wallet data:');
        console.log('Private Key:', walletData.privateKey);
        console.log('Compressed:');
        console.log('  Public Key:', walletData.compressed.publicKey);
        console.log('  Address:', walletData.compressed.address);
        console.log('Uncompressed:');
        console.log('  Public Key:', walletData.uncompressed.publicKey);
        console.log('  Address:', walletData.uncompressed.address);
        
        // Validate results
        console.log('\nValidation:');
        console.log('Private key length:', walletData.privateKey.length === 64 ? 'OK (64 chars)' : 'ERROR');
        console.log('Compressed public key starts with:', walletData.compressed.publicKey.substring(0, 2));
        console.log('Uncompressed public key starts with:', walletData.uncompressed.publicKey.substring(0, 2));
        console.log('Compressed address starts with:', walletData.compressed.address[0]);
        console.log('Uncompressed address starts with:', walletData.uncompressed.address[0]);
        
        return walletData;
    }
} 
// }); 
// }); 