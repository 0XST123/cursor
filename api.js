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

    async checkAddress(address, retryCount = 0) {
        try {
            // Добавляем минимальную задержку между запросами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 500) { // Увеличиваем минимальную задержку до 500мс
                await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
            }

            // Формируем URL для одного адреса
            const url = `${this.baseUrl}/dashboards/address/${encodeURIComponent(address)}`;
            const params = new URLSearchParams({
                key: this.API_KEY,
                limit: '0',
                state: 'latest',
                transaction_details: 'false',
                omni: 'false'
            });
            const finalUrl = `${url}?${params.toString()}`;

            const response = await fetch(finalUrl, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Если получаем 504 или 500, пробуем повторить запрос
                if ((response.status === 504 || response.status === 500) && retryCount < this.maxRetries) {
                    console.log(`Retrying request for ${address} (attempt ${retryCount + 1})`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    return this.checkAddress(address, retryCount + 1);
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

            // Проверяем наличие данных
            if (!data.data || !data.data[address] || !data.data[address].address) {
                return {
                    balance: 0,
                    transactionCount: 0,
                    hasTransactions: false,
                    totalReceived: 0,
                    totalSent: 0
                };
            }

            const addressData = data.data[address].address;
            const balance = Number(addressData.balance || 0) / 100000000;
            const txCount = Number(addressData.transaction_count || 0);
            const totalReceived = Number(addressData.received || 0) / 100000000;
            const totalSent = Number(addressData.spent || 0) / 100000000;
            const hasTransactions = txCount > 0 || totalReceived > 0 || totalSent > 0;
            
            return {
                balance,
                transactionCount: txCount,
                hasTransactions,
                totalReceived,
                totalSent
            };
        } catch (error) {
            console.error('Blockchair API error:', error);
            
            // Повторяем запрос при таймауте
            if ((error.message.includes('timeout') || error.message.includes('504')) && retryCount < this.maxRetries) {
                console.log(`Retrying request for ${address} due to timeout (attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.checkAddress(address, retryCount + 1);
            }
            
            if (error.message.includes('429')) {
                throw new Error('API limit reached');
            }
            
            // Если все попытки исчерпаны, возвращаем нулевой результат
            return {
                balance: 0,
                transactionCount: 0,
                hasTransactions: false,
                totalReceived: 0,
                totalSent: 0
            };
        }
    }

    // Оставляем метод checkAddresses для совместимости, но используем последовательные запросы
    async checkAddresses(addresses) {
        const results = {};
        for (const address of addresses) {
            results[address] = await this.checkAddress(address);
        }
        return results;
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