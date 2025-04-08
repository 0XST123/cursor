class WalletFinder {
    constructor() {
        // Initialize components
        this.wallet = new BitcoinWallet();
        this.phraseGenerator = new PhraseGenerator();
        this.api = new BlockchairAPI();
        
        // Batch settings
        this.batchSize = 100;
        this.currentBatch = [];
        this.delay = 1000;
        
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

        // Добавляем счетчик ошибок
        this.errorCount = 0;
        this.maxConsecutiveErrors = 5;
        this.consecutiveErrors = 0;
        this.lastProcessedIndex = 0;
        this.processedCount = 0;

        // Initialize UI
        this.initializeUI();
        this.loadState();
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
                startButton: 'startBtn',
                stopButton: 'stopBtn',
                batchSizeInput: 'batchSize',
                delayInput: 'delay',
                progressBar: 'progressBar',
                progressText: 'progressText',
                checkedCountElement: 'checkedCount',
                checkSpeedElement: 'checkSpeed',
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
                this.stopButton.addEventListener('click', () => this.stop());
            }
            if (this.batchSizeInput) {
                this.batchSizeInput.addEventListener('change', () => this.updateBatchSize());
            }
            if (this.delayInput) {
                this.delayInput.addEventListener('change', () => this.updateDelay());
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

    updateBatchSize() {
        this.batchSize = parseInt(this.batchSizeInput.value) || 100;
    }

    updateDelay() {
        this.delay = parseInt(this.delayInput.value) || 1000;
    }

    updateProgress() {
        const progress = (this.processedCount / this.currentBatch.length) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;
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

            this.checkedCountElement.textContent = this.processedCount;
            
            if (this.startTime) {
                const elapsedSeconds = (Date.now() - this.startTime) / 1000;
                const speed = (this.processedCount / elapsedSeconds).toFixed(1);
                this.checkSpeedElement.textContent = speed;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    saveState() {
        const state = {
            lastProcessedIndex: this.lastProcessedIndex,
            processedCount: this.processedCount,
            currentBatch: this.currentBatch,
            batchSize: this.batchSize,
            delay: this.delay,
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
            })),
            errorCount: this.errorCount,
            maxConsecutiveErrors: this.maxConsecutiveErrors,
            consecutiveErrors: this.consecutiveErrors
        };
        localStorage.setItem('walletFinderState', JSON.stringify(state));
    }

    restoreState() {
        try {
            const savedState = localStorage.getItem('walletFinderState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.lastProcessedIndex = state.lastProcessedIndex || 0;
                this.processedCount = state.processedCount || 0;
                this.currentBatch = state.currentBatch || [];
                this.batchSize = state.batchSize || 100;
                this.delay = state.delay || 1000;
                this.stats = state.stats || { new: 0, used: 0, valuable: 0 };
                this.checkedWallets = state.checkedWallets || 0;
                this.checkedAddresses = state.checkedAddresses || 0;
                this.foundCount = state.foundCount || 0;
                this.totalBtcFound = state.totalBtcFound || 0;
                this.startTime = state.startTime || null;
                this.pauseTime = state.pauseTime || null;
                this.totalPauseTime = state.totalPauseTime || 0;
                this.errorCount = state.errorCount || 0;
                this.maxConsecutiveErrors = state.maxConsecutiveErrors || 5;
                this.consecutiveErrors = state.consecutiveErrors || 0;

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
        this.currentBatch = [];
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
        this.errorCount = 0;
        this.maxConsecutiveErrors = 5;
        this.consecutiveErrors = 0;
        this.lastProcessedIndex = 0;
        this.processedCount = 0;

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
        this.errorCount = 0;
        this.maxConsecutiveErrors = 5;
        this.consecutiveErrors = 0;
        
        // Reset batch
        this.currentBatch = [];
        this.lastProcessedIndex = 0;
        this.processedCount = 0;
        
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

    stop() {
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
        console.log(`Processing paused at batch #${this.currentBatch.length}, position ${this.lastProcessedIndex}`);
    }

    async start() {
        if (this.isRunning) return;

        try {
            // Если есть незавершенная партия, продолжаем с текущей позиции
            if (this.currentBatch.length > 0 && this.lastProcessedIndex < this.currentBatch.length) {
                console.log(`Resuming batch #${this.currentBatch.length}, position ${this.lastProcessedIndex}`);
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
            await this.processNextBatch();
        } catch (error) {
            console.error('Error in start:', error);
            // Обрабатываем только критические ошибки, не связанные с API
            if (error.message !== 'API limit reached' && error.message !== 'API request timeout') {
                alert(`Critical error: ${error.message}`);
            }
            this.stop();
        }
    }

    getWalletStatus(data) {
        if (data.error) {
            return {
                type: 'error',
                text: `Ошибка: ${data.error}`,
                details: data.error
            };
        }

        if (data.balance > 0) {
            return {
                type: 'valuable',
                text: `Найден баланс: ${data.balance.toFixed(8)} BTC`,
                details: `Баланс: ${data.balance.toFixed(8)} BTC, Транзакций: ${data.transactionCount}`
            };
        }

        if (data.hasTransactions || data.transactionCount > 0 || data.totalReceived > 0 || data.totalSent > 0) {
            return {
                type: 'used',
                text: 'Адрес использовался',
                details: `Транзакций: ${data.transactionCount}, Получено: ${data.totalReceived.toFixed(8)} BTC, Отправлено: ${data.totalSent.toFixed(8)} BTC`
            };
        }

        return {
            type: 'new',
            text: 'Не использовался',
            details: 'Нет транзакций'
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
            <td title="${walletData.sourcePhrase}">${walletData.sourcePhrase}</td>
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
        historyItem.dataset.sourcePhrase = data.sourcePhrase;
        historyItem.dataset.balance = data.balance;
        historyItem.dataset.status = JSON.stringify(data.status);
        historyItem.dataset.timestamp = data.timestamp;
        
        historyItem.innerHTML = `
            <div>Batch #${data.batchNumber} - ${new Date(data.timestamp).toLocaleString()}</div>
            <div>Source Phrase: ${data.sourcePhrase}</div>
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
        if (!this.isRunning) return;

        try {
            const batch = this.currentBatch.slice(this.lastProcessedIndex, this.lastProcessedIndex + this.batchSize);
            if (batch.length === 0) {
                this.stop();
                return;
            }

            const results = await this.api.checkAddressesBatch(batch);
            
            for (const result of results) {
                if (!this.isRunning) return;
                
                this.processedCount++;
                this.updateProgress();
                this.updateStats();
                
                if (result.error) {
                    this.errorCount++;
                    if (this.errorCount >= this.maxConsecutiveErrors) {
                        console.warn('Too many consecutive errors, pausing...');
                        await new Promise(resolve => setTimeout(resolve, this.delay * 2));
                        this.errorCount = 0;
                    }
                } else {
                    this.errorCount = 0;
                }
            }

            this.lastProcessedIndex += batch.length;
            this.saveState();
            
            if (this.isRunning) {
                setTimeout(() => this.processNextBatch(), this.delay);
            }
        } catch (error) {
            console.error('Error processing batch:', error);
            this.errorCount++;
            
            if (this.errorCount >= this.maxConsecutiveErrors) {
                console.warn('Too many consecutive errors, stopping...');
                this.stop();
            } else {
                setTimeout(() => this.processNextBatch(), this.delay * 2);
            }
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

