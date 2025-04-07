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
        
        this.checkedWallets = 0;
        this.checkedAddresses = 0;
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
            const requiredElements = {
                startButton: 'startButton',
                stopButton: 'stopButton',
                newCountElement: 'newCount',
                usedCountElement: 'usedCount',
                valuableCountElement: 'valuableCount',
                totalBtcFoundElement: 'totalBtcFound',
                resultsTable: 'resultsTable',
                historyList: 'historyList'
            };

            const missingElements = [];
            
            // Get all elements and track missing ones
            for (const [key, id] of Object.entries(requiredElements)) {
                this[key] = document.getElementById(id);
                if (!this[key]) {
                    missingElements.push(id);
                }
            }

            // If any elements are missing, log them but continue
            if (missingElements.length > 0) {
                console.warn('Missing UI elements:', missingElements.join(', '));
            }

            // Add event listeners
            if (this.startButton) {
                this.startButton.addEventListener('click', () => this.start());
            }
            if (this.stopButton) {
                this.stopButton.disabled = true;
                this.stopButton.addEventListener('click', () => this.pause());
            }

            // Get table body reference
            if (this.resultsTable) {
                this.resultsBody = this.resultsTable.querySelector('tbody');
            }

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
        try {
            // Update status counts
            if (this.newCountElement) {
                this.newCountElement.textContent = this.stats.new;
            }
            if (this.usedCountElement) {
                this.usedCountElement.textContent = this.stats.used;
            }
            if (this.valuableCountElement) {
                this.valuableCountElement.textContent = this.stats.valuable;
            }
            if (this.totalBtcFoundElement) {
                this.totalBtcFoundElement.textContent = this.totalBtcFound.toFixed(8);
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    saveState() {
        const state = {
            currentBatch: this.currentBatch,
            stats: this.stats,
            checkedWallets: this.checkedWallets,
            checkedAddresses: this.checkedAddresses,
            foundCount: this.foundCount,
            totalBtcFound: this.totalBtcFound,
            startTime: this.startTime,
            pauseTime: this.pauseTime,
            totalPauseTime: this.totalPauseTime,
            history: Array.from(document.querySelectorAll('#historyList .history-item')).map(item => ({
                batchNumber: item.dataset.batch,
                compressedAddress: item.dataset.compressedAddress,
                uncompressedAddress: item.dataset.uncompressedAddress,
                privateKey: item.dataset.privateKey,
                balance: parseFloat(item.dataset.balance),
                status: item.dataset.status,
                timestamp: item.dataset.timestamp
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
                this.checkedWallets = state.checkedWallets || 0;
                this.checkedAddresses = state.checkedAddresses || 0;
                this.foundCount = state.foundCount;
                this.totalBtcFound = state.totalBtcFound;
                this.startTime = state.startTime;
                this.pauseTime = state.pauseTime;
                this.totalPauseTime = state.totalPauseTime || 0;

                // Restore history
                if (state.history && this.historyList) {
                    this.historyList.innerHTML = '';
                    // Разворачиваем массив, чтобы сохранить порядок новые-сверху
                    [...state.history].reverse().forEach(item => {
                        const status = JSON.parse(item.status);
                        const historyItem = document.createElement('div');
                        historyItem.className = `history-item status-${status.type}`;
                        historyItem.dataset.batch = item.batchNumber;
                        historyItem.dataset.compressedAddress = item.compressedAddress;
                        historyItem.dataset.uncompressedAddress = item.uncompressedAddress;
                        historyItem.dataset.privateKey = item.privateKey;
                        historyItem.dataset.balance = item.balance;
                        historyItem.dataset.status = item.status;
                        historyItem.dataset.timestamp = item.timestamp;
                        
                        historyItem.innerHTML = `
                            <div>Batch #${item.batchNumber} - ${new Date(item.timestamp).toLocaleString()}</div>
                            <div>Compressed: ${item.compressedAddress}</div>
                            <div>Uncompressed: ${item.uncompressedAddress}</div>
                            <div>Private Key: ${item.privateKey}</div>
                            <div>Balance: ${parseFloat(item.balance).toFixed(8)} BTC</div>
                            <div>Status: ${status.text}</div>
                        `;
                        this.historyList.appendChild(historyItem);
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
        this.checkedWallets = 0;
        this.checkedAddresses = 0;
        this.foundCount = 0;
        this.totalBtcFound = 0;
        this.startTime = null;
        this.pauseTime = null;
        this.totalPauseTime = 0;

        // Безопасно очищаем таблицу
        if (this.resultsBody) {
            this.resultsBody.innerHTML = '';
        }
        if (this.historyList) {
            this.historyList.innerHTML = '';
        }

        this.updateStats();
    }

    reload() {
        // Clear UI
        if (this.resultsBody) {
            this.resultsBody.innerHTML = '';
        }
        if (this.historyList) {
            this.historyList.innerHTML = '';
        }
        
        // Reset statistics
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0
        };
        this.checkedWallets = 0;
        this.checkedAddresses = 0;
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
        
        // Enable/disable buttons
        if (this.startButton) {
            this.startButton.disabled = false;
        }
        if (this.stopButton) {
            this.stopButton.disabled = true;
        }
        
        console.log('Application reloaded');
    }

    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.pauseTime = Date.now();

        // Обновляем состояние кнопок
        if (this.startButton) {
            this.startButton.disabled = false;
        }
        if (this.stopButton) {
            this.stopButton.disabled = true;
        }
        
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
            
            // Обновляем состояние кнопок
            if (this.startButton) {
                this.startButton.disabled = true;
            }
            if (this.stopButton) {
                this.stopButton.disabled = false;
            }

            // Основной цикл обработки
            while (this.isRunning) {
                await this.processNextBatch();
                // Добавляем задержку между батчами
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error('Error in start:', error);
            // Обрабатываем только критические ошибки, не связанные с API
            if (error.message !== 'API limit reached' && error.message !== 'API request timeout') {
                alert(`Critical error: ${error.message}`);
            }
            this.pause();
        }
    }

    getWalletStatus(data) {
        // Если есть положительный баланс - ценный кошелек
        if (data.balance > 0) {
            return {
                type: 'valuable',
                text: `Balance: ${data.balance.toFixed(8)} BTC`
            };
        }
        
        // Если есть история транзакций - использованный кошелек
        if (data.totalReceived > 0 || data.totalSent > 0) {
            return {
                type: 'used',
                text: `Used (Total: ${data.totalReceived.toFixed(8)} BTC)`
            };
        }
        
        // Если нет ни баланса, ни истории - новый кошелек
        return {
            type: 'new',
            text: 'New'
        };
    }

    addResultToTable(walletData, checkResult, index) {
        if (!this.resultsBody) return;

        // Очищаем таблицу если это первый элемент нового батча
        if (index === 0) {
            this.resultsBody.innerHTML = '';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td title="${walletData.compressed.address}">${walletData.compressed.address}</td>
            <td title="${walletData.uncompressed.address}">${walletData.uncompressed.address}</td>
            <td title="${walletData.privateKey}">${walletData.privateKey}</td>
            <td class="status-${checkResult.status.type}">${checkResult.status.text}</td>
        `;

        // Добавляем строку в таблицу
        this.resultsBody.appendChild(row);

        // Если таблица стала слишком длинной, удаляем старые записи
        while (this.resultsBody.children.length > 20) {
            this.resultsBody.removeChild(this.resultsBody.firstChild);
        }
    }

    addToHistory(data) {
        if (!this.historyList) return;

        // Проверяем, не существует ли уже такой адрес в истории
        const existingItems = Array.from(this.historyList.children);
        const isDuplicate = existingItems.some(item => {
            return item.dataset.compressedAddress === data.compressed.address || 
                   item.dataset.uncompressedAddress === data.uncompressed.address;
        });

        if (isDuplicate) {
            return;
        }

        const historyItem = document.createElement('div');
        historyItem.className = `history-item status-${data.status.type}`;
        historyItem.dataset.batch = data.batchNumber;
        historyItem.dataset.compressedAddress = data.compressed.address;
        historyItem.dataset.uncompressedAddress = data.uncompressed.address;
        historyItem.dataset.privateKey = data.privateKey;
        historyItem.dataset.balance = data.balance;
        historyItem.dataset.status = JSON.stringify(data.status);
        historyItem.dataset.timestamp = data.timestamp;
        
        historyItem.innerHTML = `
            <div>Batch #${data.batchNumber} - ${new Date(data.timestamp).toLocaleString()}</div>
            <div>Compressed: ${data.compressed.address}</div>
            <div>Uncompressed: ${data.uncompressed.address}</div>
            <div>Private Key: ${data.privateKey}</div>
            <div>Balance: ${data.balance.toFixed(8)} BTC</div>
            <div>Status: ${data.status.text}</div>
        `;
        
        // Добавляем новый элемент в начало списка
        if (this.historyList.firstChild) {
            this.historyList.insertBefore(historyItem, this.historyList.firstChild);
        } else {
            this.historyList.appendChild(historyItem);
        }
    }

    async processNextBatch() {
        try {
            // Generate new batch if needed
            if (this.currentBatch.keys.length === 0) {
                try {
                    const phrases = await this.phraseGenerator.generatePhrases(this.batchSize);
                    this.currentBatch.keys = [];
                    
                    // Generate wallets with error handling for each phrase
                    for (const phrase of phrases) {
                        try {
                            const wallet = this.wallet.generateWallet(phrase);
                            if (wallet && wallet.compressed && wallet.compressed.address &&
                                wallet.uncompressed && wallet.uncompressed.address) {
                                this.currentBatch.keys.push(wallet);
                            }
                        } catch (error) {
                            console.error('Error generating wallet for phrase:', phrase, error);
                        }
                    }
                    
                    this.currentBatch.processed = 0;
                    this.currentBatch.progress = 0;
                    
                    // If no valid wallets were generated, throw error
                    if (this.currentBatch.keys.length === 0) {
                        throw new Error('Failed to generate any valid wallets');
                    }
                } catch (error) {
                    console.error('Error generating batch:', error);
                    throw error;
                }
            }

            // Process wallets in batches of 40
            const BATCH_SIZE = 40;
            while (this.currentBatch.processed < this.currentBatch.keys.length) {
                if (!this.isRunning) {
                    console.log(`Processing stopped at position ${this.currentBatch.processed}`);
                    return;
                }

                try {
                    // Prepare addresses for batch check
                    const addressBatch = [];
                    const walletBatch = [];
                    const endIndex = Math.min(this.currentBatch.processed + BATCH_SIZE, this.currentBatch.keys.length);
                    
                    for (let i = this.currentBatch.processed; i < endIndex; i++) {
                        const walletData = this.currentBatch.keys[i];
                        if (walletData && walletData.compressed && walletData.uncompressed &&
                            walletData.compressed.address && walletData.uncompressed.address) {
                            addressBatch.push(walletData.compressed.address);
                            addressBatch.push(walletData.uncompressed.address);
                            walletBatch.push(walletData);
                        }
                    }

                    // Check addresses in batch
                    const batchResults = await this.api.checkAddressesBatch(addressBatch);
                    
                    // Process results for each wallet
                    for (let i = 0; i < walletBatch.length; i++) {
                        const walletData = walletBatch[i];
                        const compressedInfo = batchResults[walletData.compressed.address];
                        const uncompressedInfo = batchResults[walletData.uncompressed.address];
                        
                        // Увеличиваем счетчики
                        this.checkedAddresses += 2;
                        this.checkedWallets++;
                        this.currentBatch.processed++;
                        
                        // Определяем статус и баланс
                        const balance = Math.max(compressedInfo.balance, uncompressedInfo.balance);
                        const hasTransactions = compressedInfo.hasTransactions || uncompressedInfo.hasTransactions;
                        const totalReceived = compressedInfo.totalReceived + uncompressedInfo.totalReceived;
                        const totalSent = compressedInfo.totalSent + uncompressedInfo.totalSent;
                        
                        const status = this.getWalletStatus({ 
                            balance, 
                            hasTransactions,
                            totalReceived,
                            totalSent
                        });
                        
                        this.stats[status.type]++;
                        
                        // Update batch progress
                        this.currentBatch.progress = (this.currentBatch.processed / this.currentBatch.keys.length) * 100;
                        
                        // Add to main table with index
                        this.addResultToTable(walletData, {
                            balance: balance,
                            status: status
                        }, this.currentBatch.processed - walletBatch.length + i);

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
                    }
                    
                    // Update UI
                    this.updateStats();
                    
                    // Добавляем небольшую задержку между батчами
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error processing batch at position ${this.currentBatch.processed}:`, error);
                    // Если ошибка связана с API, останавливаем обработку
                    if (error.message === 'API limit reached') {
                        this.pause();
                        alert('API request limit reached. Processing paused.');
                        throw error;
                    }
                    // Иначе пропускаем текущий батч и продолжаем
                    this.currentBatch.processed = endIndex;
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
        } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
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