import classnames from 'classnames';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import { Decimal, DropdownComponent, OrderInput } from '../../../../components';
import { VALUATION_PRIMARY_CURRENCY } from '../../../../constants';
import { cleanPositiveFloatInput, getTotalPrice } from '../../../../helpers';
import { Currency, Market } from '../../../../modules';
import { OrderProps } from '../Order';

// tslint:disable:no-magic-numbers jsx-no-lambda jsx-no-multiline-js
type OnSubmitCallback = (order: OrderProps) => void;
type DropdownElem = number | string | React.ReactNode;
type FormType = 'buy' | 'sell';

export interface OrderFormProps {
    /**
     * Price that is applied during total order amount calculation when type is Market
     */
    priceMarket: number;
    /**
     * Price that is applied during total order amount calculation when type is Market
     */
    priceLimit?: number;
    /**
     * Type of form, can be 'buy' or 'cell'
     */
    type: FormType;
    /**
     * Available types of order
     */
    orderTypes: DropdownElem[];
    /**
     * Available types of order without translations
     */
    orderTypesIndex: DropdownElem[];
    /**
     * Additional class name. By default element receives `cr-order` class
     * @default empty
     */
    className?: string;
    /**
     * Name of currency for price field
     */
    from: string;
    /**
     * Name of currency for amount field
     */
    to: string;
    /**
     * Amount of money in a wallet
     */
    available?: number;
    /**
     * Precision of amount, total, available, fee value
     */
    currentMarketAskPrecision: number;
    /**
     * Precision of price value
     */
    currentMarketBidPrecision: number;
    /**
     * Whether order is disabled to execute
     */
    disabled?: boolean;
    /**
     * Callback that is called when form is submitted
     */
    onSubmit: OnSubmitCallback;
    /**
     * @default 'Order Type'
     * Text for order type dropdown label.
     */
    orderTypeText?: string;
    /**
     * @default 'Price'
     * Text for Price field Text.
     */
    priceText?: string;
    /**
     * @default 'Amount'
     * Text for Amount field Text.
     */
    amountText?: string;
    /**
     * @default 'Total'
     * Text for Total field Text.
     */
    totalText?: string;
    /**
     * @default 'Available'
     * Text for Available field Text.
     */
    availableText?: string;
    /**
     * @default type.toUpperCase()
     * Text for submit Button.
     */
    submitButtonText?: string;
    /**
     * proposal data for buy or sell [[price, volume]]
     */
    proposals: string[][];
    /**
     * start handling change price
     */
    listenInputPrice?: () => void;
    currencies?: Currency[];
    markets?: Market[];
    setCurrentMarket: (market: Market) => void;
}

interface OrderFormState {
    orderType: string | React.ReactNode;
    amount: string;
    price: string;
    priceMarket: number;
    currentMarketAskPrecision: number;
    currentMarketBidPrecision: number;
    amountFocused: boolean;
    priceFocused: boolean;
}

const handleSetValue = (value: string | number | undefined, defaultValue: string) => (
    value || defaultValue
);

const checkButtonIsDisabled = (safeAmount: number, safePrice: number, price: string, props: OrderFormProps, state: OrderFormState) => {
    const invalidAmount = safeAmount <= 0;
    const invalidLimitPrice = Number(price) <= 0 && state.orderType === 'Limit';
    const invalidMarketPrice = safePrice <= 0 && state.orderType === 'Market';
    return props.disabled || !props.available || invalidAmount || invalidLimitPrice || invalidMarketPrice;
};

export class OrderForm extends React.Component<OrderFormProps, OrderFormState> {
    constructor(props: OrderFormProps) {
        super(props);
        this.state = {
            orderType: 'Market',
            amount: '',
            price: '',
            priceMarket: this.props.priceMarket,
            currentMarketAskPrecision: this.props.currentMarketAskPrecision || 6,
            currentMarketBidPrecision: this.props.currentMarketBidPrecision || 6,
            priceFocused: false,
            amountFocused: false,
        };
    }

    public componentDidMount() {
        const { currencies, markets } = this.props;

        if (currencies && markets && currencies.length && markets.length) {
            currencies.some(cur => {
                if (cur.id && cur.id.toLowerCase() !== VALUATION_PRIMARY_CURRENCY.toLowerCase()) {
                    const targetMarket = markets.find(market =>
                        (cur.id && cur.id.toLowerCase()) === market.base_unit.toLowerCase() &&
                         market.quote_unit === VALUATION_PRIMARY_CURRENCY.toLowerCase());

                    if (targetMarket) {
                        this.props.setCurrentMarket(targetMarket);

                        return true;
                    }
                }

                return false;
            });
        }
    }

    public componentWillReceiveProps(next: OrderFormProps) {
        const nextPriceLimitTruncated = Decimal.format(next.priceLimit, this.state.currentMarketBidPrecision);
        if (this.state.orderType === 'Limit' && next.priceLimit && nextPriceLimitTruncated !== this.state.price) {
            this.setState({
                price: nextPriceLimitTruncated,
            });
        }

        this.setState({
            priceMarket: next.priceMarket,
            currentMarketAskPrecision: next.currentMarketAskPrecision,
            currentMarketBidPrecision: next.currentMarketBidPrecision,
        });
    }

    public render() {
        const {
            type,
            className,
            from,
            to,
            available,
            priceText,
            amountText,
            totalText,
            availableText,
            submitButtonText,
            proposals,
            currencies,
            markets,
        } = this.props;
        const {
            orderType,
            amount,
            price,
            priceMarket,
            currentMarketAskPrecision,
            currentMarketBidPrecision,
            amountFocused,
        } = this.state;
        const safeAmount = Number(amount) || 0;
        const totalPrice = getTotalPrice(amount, proposals);
        const safePrice = totalPrice / Number(amount) || priceMarket;

        const total = orderType === 'Market'
            ? totalPrice : safeAmount * (Number(price) || 0);

        const cx = classnames('cr-order-form', className);
        const availablePrecision = type === 'buy' ? currentMarketBidPrecision : currentMarketAskPrecision;
        const availableCurrency = type === 'buy' ? from : to;
        const currenciesList = this.formatCurrencyList(currencies, markets);

        return (
            <div className={cx}>
                <div className="cr-order-form__col">
                    <div className="cr-order-item">
                        <DropdownComponent
                            className="pg-custom-filter__currency__dropdown"
                            list={currenciesList}
                            onSelect={value => this.handleChangeBaseCurrency(currenciesList[value])}
                            placeholder={''}
                        />
                    </div>
                    <div className="cr-order-item">
                        <div className="cr-order-item__available">
                            <div className="cr-order-item__available__content">
                                <span>
                                    {handleSetValue(availableText, 'Available')}&nbsp;
                                </span>
                                <span>
                                    {available ? Decimal.format(available, availablePrecision) : ''}
                                    &nbsp;
                                    {available ? availableCurrency.toUpperCase() : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="cr-order-form__col">
                    <div className="cr-order-item">
                        <OrderInput
                            currency={to}
                            label={amountText}
                            placeholder={amountText}
                            value={handleSetValue(amount, '')}
                            isFocused={amountFocused}
                            handleChangeValue={this.handleAmountChange}
                            handleFocusInput={() => this.handleFieldFocus(amountText)}
                        />
                    </div>
                    <div className="cr-order-item">
                        <div className="cr-order-item__price">
                            <span>{handleSetValue(priceText, '')}&nbsp;</span>
                            <span>1&nbsp;{from.toUpperCase()}&nbsp;&asymp;&nbsp;{handleSetValue(Decimal.format(safePrice, currentMarketBidPrecision), '0')}</span>
                        </div>
                    </div>
                    <div className="cr-order-item">
                        <div className="cr-order-item__total">
                            <label className="cr-order-item__total__label">
                                {handleSetValue(totalText, 'Total')}
                            </label>
                            <div className="cr-order-item__total__content">
                                <span className="cr-order-item__total__content__amount">
                                    {Decimal.format(total, currentMarketBidPrecision)}
                                </span>
                                <span className="cr-order-item__total__content__currency">
                                    {from.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="cr-order-item">
                        <Button
                            block={true}
                            className="btn-block mr-1 mt-1 btn-lg"
                            disabled={checkButtonIsDisabled(safeAmount, safePrice, price, this.props, this.state)}
                            onClick={this.handleSubmit}
                            size="lg"
                            variant={type === 'buy' ? 'danger' : 'success'}
                        >
                            {submitButtonText || type}&nbsp;{from.toUpperCase()}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    private handleFieldFocus = (field: string | undefined) => {
        switch (field) {
            case this.props.priceText:
                this.setState(prev => ({
                    priceFocused: !prev.priceFocused,
                }));
                this.props.listenInputPrice && this.props.listenInputPrice();
                break;
            case this.props.amountText:
                this.setState(prev => ({
                    amountFocused: !prev.amountFocused,
                }));
                break;
            default:
                break;
        }
    };

    private handleAmountChange = (value: string) => {
        const convertedValue = cleanPositiveFloatInput(String(value));
        const condition = new RegExp(`^(?:[\\d-]*\\.?[\\d-]{0,${this.state.currentMarketAskPrecision}}|[\\d-]*\\.[\\d-])$`);
        if (convertedValue.match(condition)) {
            this.setState({
                amount: convertedValue,
            });
        }
    };

    private handleSubmit = () => {
        const { available, type } = this.props;
        const { amount, price, priceMarket, orderType } = this.state;

        const order = {
            type,
            orderType,
            amount,
            price: orderType === 'Market' ? priceMarket : price,
            available: available || 0,
        };

        this.props.onSubmit(order);
        this.setState({
            amount: '',
            price: '',
        });
    };

    private formatCurrencyList = (currencies?: Currency[], markets?: Market[]) => {
        const formattedList: React.ReactNode[] = [];

        if (currencies && markets && currencies.length && markets.length) {
            currencies.reduce((acc, cur) => {
                if (cur.id && cur.id.toLowerCase() !== VALUATION_PRIMARY_CURRENCY.toLowerCase()) {
                    if (markets.find(market =>
                        (cur.id && cur.id.toLowerCase()) === market.base_unit.toLowerCase() &&
                         market.quote_unit === VALUATION_PRIMARY_CURRENCY.toLowerCase())) {
                        formattedList.push(cur.name);
                    }
                }

                return acc;
            }, {});
        }

        return formattedList;
    }

    private handleChangeBaseCurrency = value => {
        const { currencies, markets } = this.props;
        const targetBaseUnit = currencies && currencies.length && currencies.find(cur => cur.name === value);

        if (targetBaseUnit && markets && markets.length) {
            const marketToSet = markets.find(market => market.base_unit === targetBaseUnit.id &&
                market.quote_unit === VALUATION_PRIMARY_CURRENCY.toLowerCase());

            if (marketToSet) {
                this.props.setCurrentMarket(marketToSet);
            }
        }

        return;
    }
}