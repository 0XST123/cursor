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
            const requiredElements = {
                startButton: 'startButton',
                pauseButton: 'pauseButton',
                reloadButton: 'reloadButton',
                checkedCountElement: 'checkedCount',
                foundCountElement: 'foundCount',
                totalBtcFoundElement: 'totalBtcFound',
                speedElement: 'speed',
                apiLimitElement: 'apiLimit',
                progressBar: 'progressBar',
                resultsBody: 'resultsBody',
                historyBody: 'historyBody',
                batchNumberElement: 'batchNumber',
                batchProgressElement: 'batchProgress',
                newCountElement: 'newCount',
                usedCountElement: 'usedCount',
                valuableCountElement: 'valuableCount'
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
            if (this.pauseButton) {
                this.pauseButton.disabled = true;
                this.pauseButton.addEventListener('click', () => this.pause());
            }
            if (this.reloadButton) {
                this.reloadButton.addEventListener('click', () => this.reload());
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
        // Update only available elements
        try {
            // Update general stats
            if (this.checkedCountElement) {
                this.checkedCountElement.textContent = this.checkedCount;
            }
            if (this.foundCountElement) {
                this.foundCountElement.textContent = this.foundCount;
            }
            if (this.totalBtcFoundElement) {
                this.totalBtcFoundElement.textContent = this.totalBtcFound.toFixed(8);
            }
            
            // Calculate and update speed
            if (this.speedElement) {
                if (this.startTime) {
                    const currentTime = this.isRunning ? Date.now() : (this.pauseTime || Date.now());
                    const effectiveTime = currentTime - this.startTime - this.totalPauseTime;
                    const elapsedSeconds = effectiveTime / 1000;
                    const speed = elapsedSeconds > 0 ? (this.checkedCount / elapsedSeconds).toFixed(2) : '0.00';
                    this.speedElement.textContent = speed;
                } else {
                    this.speedElement.textContent = '0.00';
                }
            }
            
            // Update batch information
            if (this.batchNumberElement) {
                this.batchNumberElement.textContent = this.currentBatch.number;
            }
            if (this.batchProgressElement) {
                this.batchProgressElement.textContent = `${Math.round(this.currentBatch.progress)}%`;
            }
            
            // Update wallet type counts
            if (this.newCountElement) {
                this.newCountElement.textContent = this.stats.new;
            }
            if (this.usedCountElement) {
                this.usedCountElement.textContent = this.stats.used;
            }
            if (this.valuableCountElement) {
                this.valuableCountElement.textContent = this.stats.valuable;
            }
            
            // Update progress bar
            if (this.progressBar) {
                this.progressBar.style.width = `${this.currentBatch.progress}%`;
            }
            
            // Update API limit if available
            if (this.apiLimitElement) {
                const requestsLeft = this.api.getRequestsLeft();
                if (requestsLeft !== Infinity) {
                    this.apiLimitElement.textContent = requestsLeft;
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
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
                            <td class="status-${item.status.type}">${item.status}</td>
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
        if (data.balance > 0) {
            return {
                type: 'valuable',
                text: 'Valuable'
            };
        }
        
        if (data.hasTransactions || data.totalReceived > 0 || data.totalSent > 0) {
            return {
                type: 'used',
                text: 'Used'
            };
        }
        
        return {
            type: 'new',
            text: 'New'
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
            <td class="address-cell">
                <div class="address-type">Compressed:</div>
                <div class="address-value">${walletData.compressed.address}</div>
                <div class="address-type">Uncompressed:</div>
                <div class="address-value">${walletData.uncompressed.address}</div>
            </td>
            <td class="key-cell">${walletData.privateKey}</td>
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
            const addressCell = row.querySelector('.address-cell');
            if (!addressCell) return false;
            const addressValues = Array.from(addressCell.querySelectorAll('.address-value'))
                .map(div => div.textContent);
            return addressValues.includes(data.compressed.address) || 
                   addressValues.includes(data.uncompressed.address);
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
            <td class="address-cell">
                <div class="address-type">Compressed:</div>
                <div class="address-value">${data.compressed.address}</div>
                <div class="address-type">Uncompressed:</div>
                <div class="address-value">${data.uncompressed.address}</div>
            </td>
            <td class="key-cell">${data.privateKey}</td>
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
        try {
            // Generate new batch if needed
            if (this.currentBatch.keys.length === 0) {
                try {
                    const phrases = this.phraseGenerator.generatePhrases(this.batchSize);
                    this.currentBatch.keys = [];
                    
                    // Generate wallets with error handling for each phrase
                    for (const phrase of phrases) {
                        try {
                            const wallet = this.wallet.generateWallet(phrase);
                            if (wallet && wallet.compressed && wallet.compressed.address &&
                                wallet.uncompressed && wallet.uncompressed.address) {
                                this.currentBatch.keys.push(wallet);
                            } else {
                                console.error('Invalid wallet generated for phrase:', phrase);
                            }
                        } catch (error) {
                            console.error('Error generating wallet for phrase:', phrase, error);
                        }
                    }
                    
                    this.currentBatch.processed = 0;
                    this.currentBatch.progress = 0;
                    console.log(`Generated new batch #${this.currentBatch.number} with ${this.currentBatch.keys.length} valid keys`);
                    
                    // If no valid wallets were generated, throw error
                    if (this.currentBatch.keys.length === 0) {
                        throw new Error('Failed to generate any valid wallets');
                    }
                } catch (error) {
                    console.error('Error generating batch:', error);
                    throw error;
                }
            }

            // Process current batch
            for (let i = this.currentBatch.processed; i < this.currentBatch.keys.length; i++) {
                if (!this.isRunning) {
                    console.log(`Processing stopped at position ${i}`);
                    return;
                }

                try {
                    const walletData = this.currentBatch.keys[i];
                    
                    // Verify wallet data before processing
                    if (!walletData || !walletData.compressed || !walletData.uncompressed ||
                        !walletData.compressed.address || !walletData.uncompressed.address) {
                        console.error('Invalid wallet data at position', i);
                        continue;
                    }
                    
                    // Проверяем оба адреса параллельно
                    const [compressedInfo, uncompressedInfo] = await Promise.all([
                        this.api.checkAddress(walletData.compressed.address),
                        this.api.checkAddress(walletData.uncompressed.address)
                    ]);
                    
                    // Увеличиваем счетчик на 2, так как проверили 2 адреса
                    this.checkedCount += 2;
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
                    // Если ошибка связана с API, останавливаем обработку
                    if (error.message === 'API limit reached' || error.message === 'API request timeout') {
                        this.pause();
                        alert(error.message === 'API limit reached' ? 
                            'API request limit reached. Processing paused.' :
                            'API request timeout. Processing paused.');
                        throw error;
                    }
                    // Иначе продолжаем со следующим кошельком
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
        } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
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