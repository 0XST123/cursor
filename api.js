// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        this.API_KEY = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.requestsLeft = 0;
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    async checkAddressesBatch(addresses, retryCount = 0) {
        try {
            // Добавляем минимальную задержку между запросами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 500) {
                await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
            }

            // Формируем URL для batch-запроса
            const addressList = addresses.join(',');
            const url = `${this.baseUrl}/dashboards/addresses/${addressList}`;
            const params = new URLSearchParams({
                key: this.API_KEY,
                limit: '0',
                state: 'latest',
                transaction_details: 'false',
                omni: 'false'
            });
            const finalUrl = `${url}?${params.toString()}`;

            const response = await fetch(finalUrl, {
                timeout: 30000, // 30 second timeout for batch requests
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if ((response.status === 504 || response.status === 500) && retryCount < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    return this.checkAddressesBatch(addresses, retryCount + 1);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.lastRequestTime = Date.now();

            // Обновляем информацию о лимитах API
            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            // Обрабатываем результаты для каждого адреса
            const results = {};
            for (const address of addresses) {
                if (!data.data || !data.data[address] || !data.data[address].address) {
                    results[address] = {
                        balance: 0,
                        transactionCount: 0,
                        hasTransactions: false,
                        totalReceived: 0,
                        totalSent: 0
                    };
                    continue;
                }

                const addressData = data.data[address].address;
                const balance = Number(addressData.balance || 0) / 100000000;
                const txCount = Number(addressData.transaction_count || 0);
                const totalReceived = Number(addressData.received || 0) / 100000000;
                const totalSent = Number(addressData.spent || 0) / 100000000;
                const hasTransactions = txCount > 0 || totalReceived > 0 || totalSent > 0;

                results[address] = {
                    balance,
                    transactionCount: txCount,
                    hasTransactions,
                    totalReceived,
                    totalSent
                };
            }

            return results;
        } catch (error) {
            console.error('Blockchair API batch error:', error);
            
            if ((error.message.includes('timeout') || error.message.includes('504')) && retryCount < this.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.checkAddressesBatch(addresses, retryCount + 1);
            }
            
            if (error.message.includes('429')) {
                throw new Error('API limit reached');
            }
            
            // В случае ошибки возвращаем пустые результаты для всех адресов
            return addresses.reduce((acc, address) => {
                acc[address] = {
                    balance: 0,
                    transactionCount: 0,
                    hasTransactions: false,
                    totalReceived: 0,
                    totalSent: 0
                };
                return acc;
            }, {});
        }
    }

    // Оставляем метод checkAddress для обратной совместимости
    async checkAddress(address, retryCount = 0) {
        const results = await this.checkAddressesBatch([address], retryCount);
        return results[address];
    }

    getRequestsLeft() {
        return this.requestsLeft;
    }

    getRequestsPerSecond() {
        return this.requestsPerSecond;
    }
}

// Фабрика API
class BitcoinAPIFactory {
    static createAPI() {
        return new BlockchairAPI();
    }
}

// Делаем классы доступными глобально
window.BlockchairAPI = BlockchairAPI;
window.BitcoinAPIFactory = BitcoinAPIFactory; 