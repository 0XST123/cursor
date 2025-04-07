// API провайдеры
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
            if (timeSinceLastRequest < 200) { // Минимум 200мс между запросами
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
            }

            // Формируем URL для blockchain.info API
            const url = `${this.baseUrl}/dashboards/address/${address}`;
            const separator = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${separator}key=${this.API_KEY}`;

            console.log('Requesting Blockchair URL:', finalUrl);
            const response = await fetch(finalUrl);
            const data = await response.json();
            
            // Логируем ответ для отладки
            console.log('API Response:', JSON.stringify(data, null, 2));
            
            this.lastRequestTime = Date.now();

            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            if (data.data && data.data[address]) {
                const addressData = data.data[address];
                const balance = addressData.balance || 
                              (addressData.address && addressData.address.balance) || 
                              0;
                return Number(balance) / 100000000;
            }
            
            return 0;
        } catch (error) {
            console.error('Blockchair API error:', error);
            return 0;
        }
    }

    getRequestsLeft() {
        return this.requestsLeft;
    }

    getRequestsPerSecond() {
        return this.requestsPerSecond;
    }
}

class BlockchainInfoAPI {
    constructor() {
        this.baseUrl = 'https://blockchain.info';
        this.requestsLeft = Infinity; // У blockchain.info нет явного лимита запросов
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
        this.minRequestInterval = 1000; // Минимум 1 секунда между запросами
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
    }

    async checkAddress(address) {
        try {
            // Строгий контроль частоты запросов
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
                await new Promise(resolve => 
                    setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
                );
            }

            // Формируем URL для blockchain.info API с CORS
            const finalUrl = `${this.baseUrl}/rawaddr/${address}?cors=true`;

            console.log('Requesting Blockchain.info URL:', finalUrl);
            const response = await fetch(finalUrl);
            
            // Обработка ошибок HTTP
            if (!response.ok) {
                if (response.status === 429) { // Too Many Requests
                    this.minRequestInterval *= 2; // Увеличиваем интервал
                    throw new Error('Rate limit exceeded');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Сброс счетчика ошибок при успешном запросе
            this.consecutiveErrors = 0;
            this.lastRequestTime = Date.now();

            // Проверка структуры ответа
            if (!data || typeof data.final_balance === 'undefined' || typeof data.n_tx === 'undefined') {
                throw new Error('Invalid API response structure');
            }

            // Расчет скорости запросов
            const requestTime = (Date.now() - now) / 1000;
            this.requestsPerSecond = 1 / requestTime;

            return {
                balance: Number(data.final_balance) / 100000000, // конвертация в BTC
                transactionCount: data.n_tx
            };
        } catch (error) {
            console.error('Blockchain.info API error:', error);
            
            // Увеличиваем счетчик последовательных ошибок
            this.consecutiveErrors++;
            
            // Если слишком много ошибок подряд, увеличиваем интервал
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                this.minRequestInterval *= 1.5;
                console.warn(`Increasing request interval to ${this.minRequestInterval}ms due to consecutive errors`);
                this.consecutiveErrors = 0;
            }

            // При ошибках сети делаем паузу
            if (error.message.includes('network') || error.message.includes('rate limit')) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            return {
                balance: 0,
                transactionCount: 0
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

// Фабрика API без использования модулей
class BitcoinAPIFactory {
    static createAPI() {
        return new BlockchainInfoAPI();
    }
}

// Make classes available globally
window.BlockchairAPI = BlockchairAPI;
window.BlockchainInfoAPI = BlockchainInfoAPI;
window.BitcoinAPIFactory = BitcoinAPIFactory; 