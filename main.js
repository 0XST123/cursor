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

            // Обновляем счетчик API запросов вместо проверенных адресов
            if (this.checkedCountElement) {
                this.checkedCountElement.textContent = this.apiRequestCount;
            }
            
            if (this.startTime) {
                const elapsedSeconds = (Date.now() - this.startTime) / 1000;
                const speed = (this.apiRequestCount / elapsedSeconds).toFixed(1);
                if (this.checkSpeedElement) {
                    this.checkSpeedElement.textContent = speed;
                }
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

    initResultsTable() {
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Адрес</th>
                    <th>Транзакции</th>
                    <th>Баланс</th>
                    <th>Всего получено</th>
                    <th>Всего отправлено</th>
                    <th>Статус</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        return table;
    }

    addResultToTable(walletData, checkResult, index) {
        if (!this.resultsBody) return;

        try {
            // Проверяем, что это результат пакетной проверки
            if (!walletData.compressed || !walletData.uncompressed) {
                console.log('Skipping non-batch result');
                return;
            }

            console.log('Adding batch result to table:', { walletData, checkResult, index });
            
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
                <td>${checkResult.balance ? checkResult.balance + ' BTC' : '0 BTC'}</td>
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
        console.log('Adding to history:', data);

        // Проверяем формат данных (пакетная проверка или одиночная)
        if (data.compressed || data.uncompressed) {
            // Пакетная проверка
            const isDuplicate = this.historyItems.some(item => 
                (item.compressed && item.compressed.address === data.compressed.address) || 
                (item.uncompressed && item.uncompressed.address === data.uncompressed.address)
            );

            if (isDuplicate) {
                console.log('Duplicate wallet found, skipping');
                return;
            }
        } else {
            // Одиночная проверка
            const isDuplicate = this.historyItems.some(item => 
                item.address === data.address
            );

            if (isDuplicate) {
                console.log('Duplicate address found, skipping');
                return;
            }
        }

        // Добавляем новый элемент в начало массива
        this.historyItems.unshift(data);
        console.log('Added to history:', data);

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

            // Собираем все адреса для проверки
            const compressedAddresses = this.currentBatch.map(w => w.compressed.address);
            const uncompressedAddresses = this.currentBatch.map(w => w.uncompressed.address);

            // Проверяем балансы пакетами по 100 адресов
            console.log('Checking compressed addresses batch');
            const compressedResults = await this.api.checkAddressesBalances(compressedAddresses);
            
            console.log('Checking uncompressed addresses batch');
            const uncompressedResults = await this.api.checkAddressesBalances(uncompressedAddresses);

            // Обрабатываем результаты для каждого кошелька
            for (let i = 0; i < this.currentBatch.length; i++) {
                const wallet = this.currentBatch[i];
                
                const compressedResult = compressedResults[wallet.compressed.address] || { balance: 0, hasBalance: false };
                const uncompressedResult = uncompressedResults[wallet.uncompressed.address] || { balance: 0, hasBalance: false };

                // Определяем статусы на основе балансов
                const compressedStatus = this.getWalletStatus(compressedResult);
                const uncompressedStatus = this.getWalletStatus(uncompressedResult);

                // Если найден баланс > 0, делаем детальную проверку
                if (compressedResult.hasBalance || uncompressedResult.hasBalance) {
                    console.log('Found wallet with balance, checking details');
                    
                    if (compressedResult.hasBalance) {
                        const details = await this.api.checkAddressDetails(wallet.compressed.address);
                        compressedResult.transactionCount = details.transactionCount;
                        compressedResult.totalReceived = details.totalReceived;
                        compressedResult.totalSent = details.totalSent;
                    }
                    
                    if (uncompressedResult.hasBalance) {
                        const details = await this.api.checkAddressDetails(wallet.uncompressed.address);
                        uncompressedResult.transactionCount = details.transactionCount;
                        uncompressedResult.totalReceived = details.totalReceived;
                        uncompressedResult.totalSent = details.totalSent;
                    }

                    // Добавляем в историю только если есть баланс
                    this.addToHistory({
                        ...wallet,
                        compressed: { ...wallet.compressed, ...compressedResult },
                        uncompressed: { ...wallet.uncompressed, ...uncompressedResult }
                    });
                }

                // Определяем общий статус кошелька
                const walletStatus = {
                    type: compressedStatus.type === 'valuable' || uncompressedStatus.type === 'valuable' ? 'valuable' :
                          compressedStatus.type === 'used' || uncompressedStatus.type === 'used' ? 'used' : 
                          'new',
                    text: compressedStatus.type === 'valuable' ? `Balance: ${compressedResult.balance.toFixed(8)} BTC` :
                          uncompressedStatus.type === 'valuable' ? `Balance: ${uncompressedResult.balance.toFixed(8)} BTC` :
                          'New address'
                };

                // Добавляем результат в таблицу
                this.addResultToTable(wallet, { status: walletStatus });
                
                // Обновляем статистику
                this.updateStatsForWallet(compressedStatus, uncompressedStatus, compressedResult, uncompressedResult);
                
                this.processedCount++;
                this.lastProcessedIndex = i;
                this.updateProgress();
            }

            // Планируем следующий батч
            if (this.isRunning) {
                setTimeout(() => this.processBatch(), this.delay);
            }

        } catch (error) {
            console.error('Error processing batch:', error);
            this.errorCount++;
            
            if (this.errorCount >= this.maxConsecutiveErrors) {
                console.error('Too many consecutive errors, stopping');
                this.stop();
                alert('Stopped due to too many errors. Please check the console for details.');
            } else {
                // Повторяем попытку через delay мс
                setTimeout(() => this.processBatch(), this.delay);
            }
        }
    }

    updateStatsForWallet(compressedStatus, uncompressedStatus, compressedResult, uncompressedResult) {
        try {
            // Обновляем счетчик API запросов
            this.apiRequestCount++;

            // Обновляем статистику на основе результатов
            if (compressedResult.balance > 0 || uncompressedResult.balance > 0) {
                this.stats.valuable++;
                this.stats.totalBtc += (compressedResult.balance || 0) + (uncompressedResult.balance || 0);
            } else {
                this.stats.new++;
            }

            this.updateStats();
        } catch (error) {
            console.error('Error updating stats:', error);
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
        const historyContainer = document.getElementById('historyContainer');
        if (!historyContainer) return;

        if (this.historyItems.length === 0) {
            historyContainer.innerHTML = '<p>История пуста</p>';
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Compressed</th>
                        <th>Uncompressed</th>
                        <th>Private Key</th>
                        <th>Phrase</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.historyItems.forEach((item, index) => {
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.compressed?.address || 'N/A'}</td>
                    <td>${item.uncompressed?.address || 'N/A'}</td>
                    <td>${item.privateKey || 'N/A'}</td>
                    <td>${item.phrase || 'N/A'}</td>
                    <td>${item.balance ? item.balance + ' BTC' : '0 BTC'}</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        historyContainer.innerHTML = tableHTML;
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
        try {
            const address = this.singleAddressInput.value.trim();
            
            if (!address) {
                alert('Please enter a Bitcoin address');
                return;
            }

            // Disable input and button while checking
            this.singleAddressInput.disabled = true;
            this.checkSingleAddressBtn.disabled = true;
            
            console.log('Checking single address:', address);
            
            // Get the results table
            const resultsTable = document.getElementById('singleCheckResultsTable');
            if (!resultsTable) {
                console.error('Results table not found');
                return;
            }

            const tbody = resultsTable.querySelector('tbody');
            if (!tbody) {
                console.error('Table body not found');
                return;
            }

            // Clear previous results
            tbody.innerHTML = '';

            const result = await this.api.checkAddressDetails(address);
            console.log('Check result:', result);

            // Create new row
            const row = document.createElement('tr');
            const statusText = result.balance > 0 ? 'Has balance' : 'Empty';
            const statusClass = result.balance > 0 ? 'status-valuable' : 'status-used';

            row.innerHTML = `
                <td>1</td>
                <td>${address}</td>
                <td>${result.txs || '0'}</td>
                <td>${result.balance ? result.balance + ' BTC' : '0 BTC'}</td>
                <td>${result.received ? result.received + ' BTC' : '0 BTC'}</td>
                <td>${result.sent ? result.sent + ' BTC' : '0 BTC'}</td>
                <td class="${statusClass}">${statusText}</td>
            `;

            tbody.appendChild(row);

        } catch (error) {
            console.error('Error checking single address:', error);
            const resultsTable = document.getElementById('singleCheckResultsTable');
            if (resultsTable) {
                resultsTable.innerHTML = `<p class="error">Error checking address: ${error.message}</p>`;
            }
        } finally {
            // Re-enable input and button
            this.singleAddressInput.disabled = false;
            this.checkSingleAddressBtn.disabled = false;
        }
    }
} 


