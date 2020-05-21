const colors = require('colors');
const ExchangeFactory = require('../exchange');
const StrategyFactory = require('../strategy');
const Position = require('../models/position');

class StrategyRunner {
    constructor({strategy, exchangeType}) {
        this.exchange = new ExchangeFactory({
            onTick: async (tickers) => { this.onTick(tickers) }, 
            updateSymbolPrices: async (prices) => { this.updateSymbolPrices(prices) },
            type: exchangeType
        });
        this.strategy = new StrategyFactory({
            sendBuySignal: async (symbol) => { this.sendBuySignal(symbol) },
            sendSellSignal: async (symbol) => { this.sendSellSignal(symbol) },
            sendTradeSignal: async (symbol) => { this.sendTradeSignal(symbol) },
            exchange: this.exchange,
            config: strategy.config
        }, strategy.type);
        this.openedPositions = [];
        this.closedPositions = [];
        this.eligibleSymbols = [];
        this.eligiblePrices = [];

        // TODO: Remove this const out and provide as config to the constructor
        this.mins = 60;
        const now = new Date();
        this.lastTickTime = new Date(now.getTime() - (this.mins * 60000));
    }

    async run({quoteSymbol, quoteMinVolume}) {
        const now = new Date();
        console.log(now.toString().green + '\n');

        this.exchange.getTickers({
            quoteSymbol: quoteSymbol,
            quoteMinVolume: quoteMinVolume 
        });
    }

    async sendBuySignal(symbol) { 
        // TODO: Need to remove this constant and set this as strategy config
        const amtToInvest = 40;

        const foundPosition = this.openedPositions.find(position => position.symbol === symbol);
        if(typeof foundPosition === 'undefined') {
            let position = new Position(symbol);
            const symbolPrice = this.eligiblePrices.find(price => price.symbol === symbol );
            position.openPosition({
                date: new Date(),
                buyPrice: symbolPrice.price,
                volume: (amtToInvest / symbolPrice.price)
            });
            this.openedPositions.push(position);
            console.log(`> BUY ${ symbol }, price: ${ symbolPrice.price }, volume: ${ (amtToInvest / symbolPrice.price) }`.green);
        } else {
            // TODO: Do proper logging to show the reason why we don't want to open the position.
            //console.log(`> ${ symbol }, position already opened. Nothing to buy.`.green);
        }
    }

    async sendSellSignal(symbol) {
        const foundPosition = this.openedPositions.find(position => position.symbol === symbol);
        if(typeof foundPosition !== 'undefined') {
            const symbolPrice = this.eligiblePrices.find(price => price.symbol === symbol);
            foundPosition.closePosition({
                date: new Date(),
                sellPrice: symbolPrice.price
            });
            this.closedPositions.push(foundPosition);
            this.openedPositions = this.openedPositions.filter(position => position.symbol !== foundPosition.symbol);
            console.log(`> SELL ${ symbol }, price: ${ symbolPrice.price }`.red);
            foundPosition.toString();
        } else {
            // TODO: Do proper logging to show the reason why we can't close the position.
            //console.log(`> ${ symbol }, no position opened. Nothing to sell.`.red); 
        }
    }

    async sendTradeSignal(symbol) {
        
    }

    // TODO: Getting the current prices for the pairs evaluated in the strategy should be done every second or less
    // Should be using a web socket instead of getting the prices from a common API.
    async onTick(tickers) {
        const now = new Date();
        const diffMs = now - this.lastTickTime
        const diffMins = Math.floor(diffMs/60000);

        // TODO: Make sure that if there is an opened position with a pair that has been removed from the eligible pairs
        // It is actually remaining in the eligible pairs so that the strategy can find the proper exit point for it

        // TODO: To store the 60 min in a constant or get it from the StrategyRunner config
        if(diffMins >= this.mins) {
            this.lastTickTime = now;
            this.eligibleTickers = tickers;
            this.eligibleSymbols = [];
            tickers.forEach(ticker => {
                this.eligibleSymbols.push(ticker.symbol);
            });
            console.log(`Eligible pairs for running the strategy: ${ this.eligibleSymbols.length }`);
            console.log(this.eligibleSymbols);
        }

        // TODO: To store the 5 min interval in a constant or to get it from the StrategyRunner config
        if(diffMins >= 5) {
            this.eligiblePrices = await this.exchange.getPrices(this.eligibleSymbols);
            this.eligibleSymbols.forEach(symbol => {
                this.strategy.evaluate({
                    symbol: symbol
                });
            });
        }
    }

    async updateSymbolPrices(symbolPrice) {
        this.eligiblePrices = symbolPrice;
    }
}

module.exports = StrategyRunner