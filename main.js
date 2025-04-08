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
            valuable: 0,
            totalBtc: 0
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
        this.restoreState();
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
        try {
            const state = {
                lastProcessedIndex: this.lastProcessedIndex,
                processedCount: this.processedCount,
                currentBatch: this.currentBatch,
                batchSize: this.batchSize,
                delay: this.delay,
                stats: this.stats,
                totalBtcFound: this.totalBtcFound
            };
            localStorage.setItem('walletFinderState', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving state:', error);
        }
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
                this.totalBtcFound = state.totalBtcFound || 0;
                
                // Обновляем UI
                if (this.batchSizeInput) this.batchSizeInput.value = this.batchSize;
                if (this.delayInput) this.delayInput.value = this.delay;
                this.updateProgress();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error restoring state:', error);
            // В случае ошибки используем значения по умолчанию
            this.resetState();
        }
    }

    resetState() {
        this.currentBatch = [];
        this.lastProcessedIndex = 0;
        this.processedCount = 0;
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0
        };
        this.totalBtcFound = 0;
        this.errorCount = 0;
        this.saveState();
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
            this.isRunning = true;
            
            // Генерируем новый батч если нет текущего или он уже обработан
            if (this.currentBatch.length === 0 || this.lastProcessedIndex >= this.currentBatch.length) {
                this.currentBatch = [];
                for (let i = 0; i < this.batchSize; i++) {
                    const phrase = this.phraseGenerator.generatePhrase();
                    const wallet = this.wallet.generateWallet(phrase);
                    this.currentBatch.push({
                        phrase,
                        ...wallet
                    });
                }
                this.lastProcessedIndex = 0;
                this.processedCount = 0;
            }
            
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
            if (error.message !== 'API limit reached' && error.message !== 'API request timeout') {
                alert(`Critical error: ${error.message}`);
            }
            this.stop();
        }
    }

    getWalletStatus(result) {
        if (result.error) {
            return {
                type: 'error',
                text: `Error: ${result.error}`
            };
        }

        if (result.balance > 0) {
            return {
                type: 'valuable',
                text: `Balance: ${result.balance.toFixed(8)} BTC`
            };
        }

        if (result.hasTransactions) {
            return {
                type: 'used',
                text: `Used (${result.transactionCount} tx)`
            };
        }

        return {
            type: 'new',
            text: 'New address'
        };
    }

    addResultToTable(walletData, checkResult, index) {
        if (!this.resultsBody) return;

        // Очищаем таблицу если это первый элемент нового батча
        if (index === 0) {
            this.resultsBody.innerHTML = '';
        }

        const row = document.createElement('tr');
        
        // Добавляем основную информацию
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                ${walletData.compressed.address}
                <div class="details-row">Format: Legacy (P2PKH)</div>
            </td>
            <td>
                ${walletData.uncompressed.address}
                <div class="details-row">Format: Legacy (P2PKH)</div>
            </td>
            <td>
                ${walletData.privateKey}
                <div class="details-row">WIF: ${this.wallet.privateKeyToWIF(walletData.privateKey)}</div>
            </td>
            <td>
                ${walletData.phrase}
                <div class="details-row">Hash: ${CryptoJS.SHA256(walletData.phrase).toString()}</div>
            </td>
            <td class="status-${checkResult.status.type}">
                ${checkResult.status.text}
            </td>
        `;

        // Добавляем строку в таблицу
        this.resultsBody.appendChild(row);

        // Если таблица стала слишком длинной, удаляем старые записи
        while (this.resultsBody.children.length > 20) {
            this.resultsBody.removeChild(this.resultsBody.firstChild);
        }
    }

    addToHistory(data) {
        try {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // Определяем общий статус кошелька
            const compressedStatus = data.compressed.status || { type: 'error', text: 'Error checking address' };
            const uncompressedStatus = data.uncompressed.status || { type: 'error', text: 'Error checking address' };
            
            // Выбираем наиболее важный статус
            const status = compressedStatus.type === 'valuable' || uncompressedStatus.type === 'valuable' ? 'valuable' :
                          compressedStatus.type === 'used' || uncompressedStatus.type === 'used' ? 'used' : 'new';
            
            historyItem.classList.add(`status-${status}`);
            
            historyItem.innerHTML = `
                <div class="history-header">
                    <span>Batch #${data.batchNumber}</span>
                    <span>${new Date(data.timestamp).toLocaleString()}</span>
                </div>
                <div class="history-addresses">
                    <div class="address-item">
                        <div class="address-label">Compressed:</div>
                        <div class="address-value">${data.compressed.address}</div>
                        <div class="address-status">${compressedStatus.text}</div>
                    </div>
                    <div class="address-item">
                        <div class="address-label">Uncompressed:</div>
                        <div class="address-value">${data.uncompressed.address}</div>
                        <div class="address-status">${uncompressedStatus.text}</div>
                    </div>
                </div>
                <div class="history-details">
                    <div class="detail-item">
                        <span class="detail-label">Private Key:</span>
                        <span class="detail-value">${data.privateKey}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Source Phrase:</span>
                        <span class="detail-value">${data.sourcePhrase}</span>
                    </div>
                    ${data.balance > 0 ? `
                        <div class="detail-item">
                            <span class="detail-label">Balance:</span>
                            <span class="detail-value">${data.balance.toFixed(8)} BTC</span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Добавляем в начало списка
            const historyList = document.getElementById('historyList');
            if (historyList) {
                historyList.insertBefore(historyItem, historyList.firstChild);
            }
        } catch (error) {
            console.error('Error adding to history:', error);
        }
    }

    async processNextBatch() {
        if (!this.isRunning) return;

        try {
            const currentBatchSlice = this.currentBatch.slice(this.lastProcessedIndex, this.lastProcessedIndex + this.batchSize);
            if (currentBatchSlice.length === 0) {
                this.stop();
                return;
            }

            // Очищаем таблицу перед началом нового батча
            if (this.lastProcessedIndex === 0) {
                this.resultsBody.innerHTML = '';
            }

            // Сначала добавляем все строки в таблицу со статусом "проверка"
            currentBatchSlice.forEach((wallet, i) => {
                this.addResultToTable(wallet, {
                    status: {
                        type: 'checking',
                        text: 'Checking...'
                    }
                }, i);
            });

            // Собираем все адреса для проверки
            const addressesToCheck = currentBatchSlice.reduce((acc, wallet) => {
                acc.push(wallet.compressed.address);
                acc.push(wallet.uncompressed.address);
                return acc;
            }, []);

            const results = await this.api.checkAddressesBatch(addressesToCheck);
            
            // Обрабатываем результаты
            for (let i = 0; i < currentBatchSlice.length; i++) {
                if (!this.isRunning) return;
                
                const wallet = currentBatchSlice[i];
                const compressedResult = results[i * 2];
                const uncompressedResult = results[i * 2 + 1];
                
                // Проверяем результаты
                const compressedStatus = this.getWalletStatus(compressedResult || { error: 'No data' });
                const uncompressedStatus = this.getWalletStatus(uncompressedResult || { error: 'No data' });
                
                // Определяем общий статус кошелька
                const walletStatus = {
                    type: compressedStatus.type === 'valuable' || uncompressedStatus.type === 'valuable' ? 'valuable' :
                          compressedStatus.type === 'used' || uncompressedStatus.type === 'used' ? 'used' :
                          compressedStatus.type === 'error' && uncompressedStatus.type === 'error' ? 'error' : 'new',
                    text: compressedStatus.type === 'valuable' ? compressedStatus.text :
                          uncompressedStatus.type === 'valuable' ? uncompressedStatus.text :
                          compressedStatus.type === 'used' ? compressedStatus.text :
                          uncompressedStatus.type === 'used' ? uncompressedStatus.text :
                          compressedStatus.type === 'error' && uncompressedStatus.type === 'error' ? 'Error checking addresses' :
                          'New address'
                };
                
                // Обновляем статус в существующей строке таблицы
                const row = this.resultsBody.children[i];
                if (row) {
                    const statusCell = row.querySelector('td:last-child');
                    if (statusCell) {
                        statusCell.className = `status-${walletStatus.type}`;
                        statusCell.textContent = walletStatus.text;
                    }
                }
                
                // Добавляем в историю если есть что-то интересное
                if (walletStatus.type !== 'new') {
                    this.addToHistory({
                        batchNumber: Math.floor(this.lastProcessedIndex / this.batchSize) + 1,
                        compressed: {
                            address: wallet.compressed.address,
                            status: compressedStatus
                        },
                        uncompressed: {
                            address: wallet.uncompressed.address,
                            status: uncompressedStatus
                        },
                        privateKey: wallet.privateKey,
                        sourcePhrase: wallet.phrase,
                        balance: (compressedResult?.balance || 0) + (uncompressedResult?.balance || 0),
                        timestamp: Date.now()
                    });
                }
                
                // Обновляем статистику
                this.updateStatsForWallet(compressedStatus, uncompressedStatus, compressedResult, uncompressedResult);
                
                this.processedCount++;
                this.updateProgress();
                this.updateStats();
            }

            this.lastProcessedIndex += currentBatchSlice.length;
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

    updateStatsForWallet(compressedStatus, uncompressedStatus, compressedResult, uncompressedResult) {
        // Обновляем статистику по сжатому адресу
        if (compressedStatus.type === 'new') this.stats.new++;
        if (compressedStatus.type === 'used') this.stats.used++;
        if (compressedStatus.type === 'valuable') {
            this.stats.valuable++;
            this.totalBtcFound += compressedResult.balance || 0;
        }

        // Обновляем статистику по несжатому адресу
        if (uncompressedStatus.type === 'new') this.stats.new++;
        if (uncompressedStatus.type === 'used') this.stats.used++;
        if (uncompressedStatus.type === 'valuable') {
            this.stats.valuable++;
            this.totalBtcFound += uncompressedResult.balance || 0;
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


