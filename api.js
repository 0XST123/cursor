// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        this.API_KEY = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.requestsLeft = 0;
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
    }

    async checkAddress(address) {
        try {
            // Добавляем минимальную задержку между запросами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 200) {
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
            }

            // Формируем URL для одного адреса
            const url = `${this.baseUrl}/dashboards/address/${address}`;
            const params = new URLSearchParams({
                key: this.API_KEY,
                limit: '0',
                state: 'latest',
                transaction_details: 'false',
                omni: 'false'
            });
            const finalUrl = `${url}?${params.toString()}`;

            console.log('Requesting Blockchair URL:', finalUrl);
            const response = await fetch(finalUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Логируем ответ для отладки
            console.log('API Response:', JSON.stringify(data, null, 2));
            
            this.lastRequestTime = Date.now();

            // Обновляем информацию о лимитах API
            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            // Проверяем наличие данных
            if (!data.data || !data.data[address] || !data.data[address].address) {
                console.log('No data found for address:', address);
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
            
            console.log('Address analysis:', {
                address,
                balance,
                txCount,
                totalReceived,
                totalSent,
                hasTransactions
            });
            
            return {
                balance,
                transactionCount: txCount,
                hasTransactions,
                totalReceived,
                totalSent
            };
        } catch (error) {
            console.error('Blockchair API error:', error);
            if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                throw new Error('API limit reached');
            }
            if (error.message.includes('timeout')) {
                throw new Error('API request timeout');
            }
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