class WalletFinder {
    constructor() {
        // Initialize components
        this.wallet = new BitcoinWallet();
        this.phraseGenerator = new PhraseGenerator();
        
        try {
            this.api = BitcoinAPIFactory.createAPI();
            console.log('API initialized successfully');
        } catch (error) {
            console.error('Failed to initialize API:', error);
            throw new Error('API initialization failed');
        }
        
        // Batch settings
        this.batchSize = 100;
        this.currentBatch = [];
        this.delay = 1000;
        
        // Statistics
        this.stats = {
            new: 0,
            used: 0,
            valuable: 0,
            totalBtc: 0,
            errors: 0  // Добавляем счетчик ошибок в статистику
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
        this.apiRequestCount = 0; // Счетчик API запросов

        // История
        this.historyItems = [];
        this.loadHistoryFromStorage();
        
        // Initialize UI
        this.initializeUI();
        this.restoreState();

        this.exportHistoryBtn = document.getElementById('exportHistoryBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        this.exportHistoryBtn.addEventListener('click', () => this.exportHistory());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // Инициализация элементов для проверки отдельного адреса
        this.singleAddressInput = document.getElementById('singleAddressInput');
        this.checkSingleAddressBtn = document.getElementById('checkSingleAddressBtn');
        this.singleCheckResultsTable = document.getElementById('singleCheckResultsTable');
        this.singleCheckResultsBody = this.singleCheckResultsTable?.querySelector('tbody');
        
        // Добавляем обработчик
        if (this.checkSingleAddressBtn) {
            this.checkSingleAddressBtn.addEventListener('click', () => this.checkSingleAddress());
        }
        
        // Добавляем обработчик Enter в поле ввода
        if (this.singleAddressInput) {
            this.singleAddressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkSingleAddress();
                }
            });
        }

        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.start());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stop());
        }
    }

    initializeUI() {
        console.log('Initializing UI...');
        try {
            // Get UI elements
            const requiredElements = {
                startButton: 'startBtn',
                stopButton: 'stopBtn',
                testApiButton: 'testApiBtn',
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
        if (!this.progressBar || !this.progressText || !this.checkedCountElement || !this.checkSpeedElement) {
            return;
        }

        try {
            // Обновляем прогресс-бар
            const progress = (this.lastProcessedIndex / this.batchSize) * 100;
            this.progressBar.style.width = `${Math.min(progress, 100)}%`;
            this.progressBar.setAttribute('aria-valuenow', Math.min(progress, 100));

            // Обновляем текст прогресса
            this.progressText.textContent = `${this.lastProcessedIndex}/${this.batchSize}`;

            // Обновляем количество проверенных адресов (умножаем на 2, так как каждый кошелек имеет 2 адреса)
            this.checkedCountElement.textContent = (this.processedCount * 2).toString();

            // Обновляем скорость проверки
            if (this.startTime) {
                const currentTime = Date.now();
                const elapsedTime = (currentTime - this.startTime - this.totalPauseTime) / 1000; // в секундах
                if (elapsedTime > 0) {
                    // Скорость в адресах в секунду (умножаем на 2, так как каждый кошелек имеет 2 адреса)
                    const speed = ((this.processedCount * 2) / elapsedTime).toFixed(2);
                    this.checkSpeedElement.textContent = `${speed}/s`;
                }
            }

            // Обновляем статистику
            this.updateStats();
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }

    updateStats() {
        try {
            // Обновляем счетчики в интерфейсе
            if (this.newCountElement) {
                this.newCountElement.textContent = this.stats.new.toString();
            }
            if (this.usedCountElement) {
                this.usedCountElement.textContent = this.stats.used.toString();
            }
            if (this.valuableCountElement) {
                this.valuableCountElement.textContent = this.stats.valuable.toString();
            }
            if (this.totalBtcFoundElement) {
                this.totalBtcFoundElement.textContent = this.totalBtcFound.toFixed(8);
            }

            // Сохраняем текущее состояние
            this.saveState();
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
        this.apiRequestCount = 0; // Сбрасываем счетчик API запросов
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
        this.apiRequestCount = 0; // Сбрасываем счетчик API запросов
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
        
        // Clear history
        this.historyItems = [];
        this.updateHistoryDisplay();
        this.saveHistoryToStorage();
        
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
        try {
            console.log('Starting wallet finder...');
            
            if (this.isRunning) {
                console.log('Already running');
                return;
            }
            
            this.isRunning = true;
            this.startTime = Date.now();
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            
            console.log('Initialization complete, starting main process');
            this.processBatch();
        } catch (error) {
            console.error('Failed to start:', error);
            this.stop();
            alert('Failed to start: ' + error.message);
        }
    }

    addResultToTable(walletData, checkResult, index) {
        if (!this.resultsBody) return;

        try {
            console.log('Adding result to table:', { walletData, checkResult, index });
            
            // Очищаем таблицу если количество строк превышает 20
            if (this.resultsBody.children.length >= 20) {
                this.resultsBody.innerHTML = '';
            }

            const row = document.createElement('tr');
            
            // Добавляем данные в строку с проверкой на undefined
            row.innerHTML = `
                <td>${this.processedCount + 1}</td>
                <td>${walletData.compressed?.address || 'N/A'}</td>
                <td>${walletData.uncompressed?.address || 'N/A'}</td>
                <td>${walletData.privateKey || 'N/A'}</td>
                <td>${walletData.phrase || 'N/A'}</td>
                <td class="status-${checkResult.status?.type || 'new'}">${checkResult.status?.text || 'New address'}</td>
            `;

            // Добавляем строку в начало таблицы
            if (this.resultsBody.firstChild) {
                this.resultsBody.insertBefore(row, this.resultsBody.firstChild);
            } else {
                this.resultsBody.appendChild(row);
            }
            
            console.log('Row added successfully');
        } catch (error) {
            console.error('Error adding result to table:', error);
        }
    }

    getWalletStatus(result) {
        try {
            console.log('Getting wallet status for result:', result);
            
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
        } catch (error) {
            console.error('Error getting wallet status:', error);
            return {
                type: 'error',
                text: 'Error processing status'
            };
        }
    }

    addToHistory(data) {
        // Проверяем, не существует ли уже такой адрес
        const isDuplicate = this.historyItems.some(item => 
            item.compressed.address === data.compressed.address || 
            item.uncompressed.address === data.uncompressed.address
        );

        if (isDuplicate) return;

        // Добавляем новый элемент в начало массива
        this.historyItems.unshift(data);

        // Обновляем отображение и сохраняем в localStorage
        this.updateHistoryDisplay();
        this.saveHistoryToStorage();
    }

    async processBatch() {
        if (!this.isRunning) {
            console.log('Process stopped');
            return;
        }

        try {
            console.log('Processing batch...');
            // Если текущий батч закончился или его нет, генерируем новый
            if (this.lastProcessedIndex >= this.currentBatch.length) {
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

            // Собираем все адреса из текущего батча для проверки
            const addresses = this.currentBatch.flatMap(wallet => [
                wallet.compressed.address,
                wallet.uncompressed.address
            ]);

            console.log(`Checking ${addresses.length} addresses in batch`);

            // Проверяем все адреса пакетом
            const results = await this.api.checkAddressesBatch(addresses);
            console.log('Batch check results:', results);

            // Обрабатываем результаты для каждого кошелька
            for (let i = this.lastProcessedIndex; i < this.currentBatch.length && this.isRunning; i++) {
                const wallet = this.currentBatch[i];
                
                // Получаем результаты для обоих адресов
                const compressedResult = results[i * 2];
                const uncompressedResult = results[i * 2 + 1];
                
                console.log('Processing results for wallet:', {
                    compressed: compressedResult,
                    uncompressed: uncompressedResult
                });

                // Получаем статусы
                const compressedStatus = this.getWalletStatus(compressedResult);
                const uncompressedStatus = this.getWalletStatus(uncompressedResult);

                // Определяем общий статус кошелька
                const walletStatus = {
                    type: compressedStatus.type === 'valuable' || uncompressedStatus.type === 'valuable' ? 'valuable' :
                          compressedStatus.type === 'used' || uncompressedStatus.type === 'used' ? 'used' :
                          'new',
                    text: compressedStatus.type === 'valuable' ? compressedStatus.text :
                          uncompressedStatus.type === 'valuable' ? uncompressedStatus.text :
                          compressedStatus.type === 'used' ? compressedStatus.text :
                          uncompressedStatus.type === 'used' ? uncompressedStatus.text :
                          'New address'
                };

                // Добавляем результат в таблицу
                this.addResultToTable(wallet, { status: walletStatus });
                
                // Обновляем статистику
                this.updateStatsForWallet(compressedStatus, uncompressedStatus, compressedResult, uncompressedResult);
                
                // Если нашли что-то интересное, добавляем в историю
                if (walletStatus.type !== 'new') {
                    this.addToHistory({
                        batchNumber: Math.floor(i / this.batchSize) + 1,
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

                this.lastProcessedIndex = i + 1;
                this.processedCount++;
                this.updateProgress();
            }

            // Если все еще работаем, запускаем следующий батч
            if (this.isRunning) {
                setTimeout(() => this.processBatch(), this.delay);
            }

        } catch (error) {
            console.error('Error in processBatch:', error);
            this.errorCount++;
            this.consecutiveErrors++;
            
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.log('Too many consecutive errors, pausing...');
                this.stop();
                alert('Processing stopped due to too many consecutive errors. Please check the console for details.');
                return;
            }
            
            // Повторяем попытку через увеличенный интервал
            const retryDelay = Math.min(this.delay * Math.pow(2, this.consecutiveErrors), 30000);
            console.log(`Retrying in ${retryDelay}ms...`);
            setTimeout(() => this.processBatch(), retryDelay);
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

    // Загрузка истории из localStorage
    loadHistoryFromStorage() {
        try {
            const savedHistory = localStorage.getItem('walletFinderHistory');
            if (savedHistory) {
                this.historyItems = JSON.parse(savedHistory);
            }
        } catch (error) {
            console.error('Error loading history from storage:', error);
            this.historyItems = [];
        }
    }

    // Сохранение истории в localStorage
    saveHistoryToStorage() {
        try {
            localStorage.setItem('walletFinderHistory', JSON.stringify(this.historyItems));
        } catch (error) {
            console.error('Error saving history to storage:', error);
        }
    }

    // Обновление отображения истории
    updateHistoryDisplay() {
        if (!this.historyList) return;

        this.historyList.innerHTML = '';
        
        // Отображаем историю от новых к старым
        for (const data of this.historyItems) {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item status-${data.status.type}`;
            
            historyItem.innerHTML = `
                <div>Batch #${data.batchNumber} - ${new Date(data.timestamp).toLocaleString()}</div>
                <div>Phrase: ${data.sourcePhrase}</div>
                <div>Compressed: ${data.compressed.address}</div>
                <div>Uncompressed: ${data.uncompressed.address}</div>
                <div>Private Key: ${data.privateKey}</div>
                <div>Balance: ${data.balance.toFixed(8)} BTC</div>
                <div>Status: ${data.status.text}</div>
            `;
            
            this.historyList.appendChild(historyItem);
        }
    }

    exportHistory() {
        const history = {
            usedAddresses: Array.from(this.usedAddresses),
            valuableAddresses: Array.from(this.valuableAddresses),
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallet-history-${history.timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear the history? This action cannot be undone.')) {
            this.usedAddresses.clear();
            this.valuableAddresses.clear();
            console.log('History cleared successfully');
        }
    }

    async checkSingleAddress() {
        if (!this.singleAddressInput || !this.singleCheckResultsBody) return;
        
        const address = this.singleAddressInput.value.trim();
        if (!address) {
            alert('Пожалуйста, введите адрес');
            return;
        }

        try {
            // Отключаем кнопку и показываем загрузку
            this.checkSingleAddressBtn.disabled = true;
            this.checkSingleAddressBtn.textContent = 'Проверка...';
            
            // Запрашиваем данные
            const result = await this.api.checkAddress(address);
            
            // Создаем новую строку
            const row = document.createElement('tr');
            const status = this.getWalletStatus(result);
            
            // Добавляем класс статуса к строке
            row.classList.add(`status-${status.type}`);
            
            // Заполняем данные
            row.innerHTML = `
                <td>${this.singleCheckResultsBody.children.length + 1}</td>
                <td>${address}</td>
                <td>${result.balance?.toFixed(8) || '0.00000000'} BTC</td>
                <td>${result.transactionCount || 0}</td>
                <td>${result.totalReceived?.toFixed(8) || '0.00000000'} BTC</td>
                <td>${result.totalSent?.toFixed(8) || '0.00000000'} BTC</td>
                <td>${status.text}</td>
            `;
            
            // Добавляем строку в начало таблицы
            if (this.singleCheckResultsBody.firstChild) {
                this.singleCheckResultsBody.insertBefore(row, this.singleCheckResultsBody.firstChild);
            } else {
                this.singleCheckResultsBody.appendChild(row);
            }
            
            // Очищаем поле ввода
            this.singleAddressInput.value = '';
            
        } catch (error) {
            console.error('Error checking address:', error);
            alert(`Ошибка при проверке адреса: ${error.message}`);
        } finally {
            // Восстанавливаем кнопку
            this.checkSingleAddressBtn.disabled = false;
            this.checkSingleAddressBtn.textContent = 'Проверить';
        }
    }
} 


