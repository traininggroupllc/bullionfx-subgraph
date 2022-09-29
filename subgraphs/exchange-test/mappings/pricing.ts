/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token } from "../generated/schema";
import { ZERO_BD, sushiFactoryContract, bullionFXFactoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";

// let WETH_ADDRESS = "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6";
let USDC_ADDRESS = "0xaddf66e47873102ec6e809af57f407b3e865a790";
let USDC_WETH_PAIR = "0x707a32ccdd4008d40c47403c37826c766610a565";

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(USDC_WETH_PAIR); // busd is token1

  if (usdcPair !== null) {
    return usdcPair.token1Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6", // WETH
  "0xaddf66e47873102ec6e809af57f407b3e865a790", // USDC
  "0x0769fd68dfb93167989c6f7254cd0d766fb2841f", // SUSHI
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_USD = BigDecimal.fromString("10");

/**
 * Search through graph to find derived USDC per token.
 * @todo update to be derived USDC (add stablecoin estimates)
 **/
export function findUsdPerToken(token: Token, isBullionFX: boolean): BigDecimal {
  if (token.id == USDC_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = isBullionFX ?
      bullionFXFactoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i])) :
      sushiFactoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveUSD.gt(MINIMUM_LIQUIDITY_THRESHOLD_USD)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedUSD as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveUSD.gt(MINIMUM_LIQUIDITY_THRESHOLD_USD)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedUSD as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedUSD;
  let price1 = token1.derivedUSD;

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedUSD;
  let price1 = token1.derivedUSD;

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
