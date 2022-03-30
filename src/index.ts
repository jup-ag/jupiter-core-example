import { Connection, PublicKey } from "@solana/web3.js";
import fetch from "isomorphic-fetch";

import { Jupiter, RouteInfo, TOKEN_LIST_URL } from "@jup-ag/core";
import {
  ENV,
  INPUT_MINT_ADDRESS,
  OUTPUT_MINT_ADDRESS,
  USER_KEYPAIR,
  SOLANA_RPC_ENDPOINT,
  Token,
  AMOUNT,
} from "./constants";

import {
  findBestRoute
} from "./findBestRoute";

const getPossiblePairsTokenInfo = ({
  tokens,
  routeMap,
  inputToken,
}: {
  tokens: Token[];
  routeMap: Map<string, string[]>;
  inputToken?: Token;
}) => {
  try {
    if (!inputToken) {
      return {};
    }

    const possiblePairs = inputToken
      ? routeMap.get(inputToken.address) || []
      : []; // return an array of token mints that can be swapped with SOL
    const possiblePairsTokenInfo: { [key: string]: Token | undefined } = {};
    possiblePairs.forEach((address) => {
      possiblePairsTokenInfo[address] = tokens.find((t) => {
        return t.address == address;
      });
    });
    // Perform your conditionals here to use other outputToken
    // const alternativeOutputToken = possiblePairsTokenInfo[USDT_MINT_ADDRESS]
    return possiblePairsTokenInfo;
  } catch (error) {
    throw error;
  }
};

const executeSwap = async ({
  jupiter,
  route,
}: {
  jupiter: Jupiter;
  route: RouteInfo;
}) => {
  try {
    // Prepare execute exchange
    const { execute } = await jupiter.exchange({
      route,
    });

    // Execute swap
    const swapResult: any = await execute(); // Force any to ignore TS misidentifying SwapResult type

    if (swapResult.error) {
      console.log(swapResult.error);
    } else {
      console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);
      console.log(
        `inputAddress=${swapResult.inputAddress.toString()} outputAddress=${swapResult.outputAddress.toString()}`
      );
      console.log(
        `inputAmount=${swapResult.inputAmount} outputAmount=${swapResult.outputAmount}`
      );
    }
  } catch (error) {
    throw error;
  }
};


const main = async () => {
  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT); // Setup Solana RPC connection
    const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[ENV])).json(); // Fetch token list from Jupiter API

    //  Load Jupiter
    const jupiter = await Jupiter.load({
      connection,
      cluster: ENV,
      user: USER_KEYPAIR, // or public key
    });


    // If you know which input/output pair you want
    const inputToken = tokens.find((t) => t.address == INPUT_MINT_ADDRESS); // USDC Mint Info

    const maxProfitRoute = await findBestRoute(inputToken);
    console.log(`Found ${maxProfitRoute?.routes.length} leg route with max profit ${maxProfitRoute?.profit} going through routes:\
     ${JSON.stringify(maxProfitRoute?.routes)}.`);
    /*
    // Alternatively, find all possible outputToken based on your inputToken
    const possiblePairsTokenInfo = await getPossiblePairsTokenInfo({
      tokens,
      routeMap,
      inputToken,
    });

    console.log(possiblePairsTokenInfo)

    
    const routes = await getRoutes({
      jupiter,
      inputToken,
      outputToken,
      inputAmount: AMOUNT, // 1 unit in UI
      slippage: .1, // .1% slippage
    });

    const bestRoute = routes!.routesInfos[0];
    const profit = bestRoute.outAmountWithSlippage - bestRoute.inAmount;
    */
    const fee = 500; // Tx fee in USDC = ~.000005 SOL
    /*
    console.log(bestRoute);
    console.log(`Pre tx profit: ${profit}`)

    // Percentage
    // Routes that are too good to be true usually are
    const percentage = profit / bestRoute.inAmount * 100;
    */
    if (maxProfitRoute != undefined && maxProfitRoute?.profit > fee) {
      console.log(`Making trade`);
      for (let route of maxProfitRoute.routes) {
        // await executeSwap({ jupiter, route: route });
      }
    }
    main();
  } catch (error) {
    console.log({ error });
  }
};

main();