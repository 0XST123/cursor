// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        // Тестовый ключ API, для продакшена нужно заменить на реальный
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
            if (timeSinceLastRequest < 200) { // Минимум 200мс между запросами
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
            }

            // Формируем URL для Blockchair API
            const url = `${this.baseUrl}/dashboards/address/${address}`;
            const params = new URLSearchParams({
                key: this.API_KEY,
                limit: '1',    // Нам достаточно знать о первой транзакции
                state: 'latest' // Получаем только последнее состояние
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

            // Обрабатываем данные адреса
            if (data.data && data.data[address]) {
                const addressData = data.data[address];
                const balance = addressData.balance || 
                              (addressData.address && addressData.address.balance) || 
                              0;
                const txCount = addressData.transaction_count || 
                              (addressData.address && addressData.address.transaction_count) || 
                              0;
                              
                return {
                    balance: Number(balance) / 100000000, // конвертация в BTC
                    transactionCount: txCount,
                    hasTransactions: txCount > 0
                };
            }
            
            return {
                balance: 0,
                transactionCount: 0,
                hasTransactions: false
            };
        } catch (error) {
            console.error('Blockchair API error:', error);
            return {
                balance: 0,
                transactionCount: 0,
                hasTransactions: false
            };
        }
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