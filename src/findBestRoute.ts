import { Connection, Keypair, Transaction, PublicKey } from '@solana/web3.js'
import fetch from 'cross-fetch'
import { Wallet } from '@project-serum/anchor'
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

// The GenesysGo RPC endpoint is currently free to use now.
// They may charge in the future. It is recommended that
// you are using your own RPC endpoint.
const connection = new Connection(SOLANA_RPC_ENDPOINT);

const getRoutes = async ({
    jupiter,
    inputToken,
    outputToken,
    inputAmount,
    slippage,
}: {
    jupiter: Jupiter;
    inputToken?: Token;
    outputToken?: Token;
    inputAmount: number;
    slippage: number;
}) => {
    try {
        if (!inputToken || !outputToken) {
            return null;
        }

        console.log(
            `Getting routes for ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}...`
        );
        const inputAmountInSmallestUnits = inputToken
            ? Math.round(inputAmount * 10 ** inputToken.decimals)
            : 0;
        const routes =
            inputToken && outputToken
                ? await jupiter.computeRoutes({
                    inputMint: new PublicKey(inputToken.address),
                    outputMint: new PublicKey(outputToken.address),
                    inputAmount: inputAmountInSmallestUnits, // raw input amount of tokens
                    slippage,
                    forceFetch: true,
                })
                : null;

        if (routes && routes.routesInfos) {
            console.log("Possible number of routes:", routes.routesInfos.length);
            console.log(
                "Best quote: ",
                routes.routesInfos[0].outAmount / 10 ** outputToken.decimals,
                `(${outputToken.symbol})`
            );
            return routes;
        } else {
            return null;
        }
    } catch (error) {
        throw error;
    }
}

export const findBestRoute = async (inToken: Token | undefined) => {
    //  Load Jupiter
    const jupiter = await Jupiter.load({
        connection,
        cluster: ENV,
        user: USER_KEYPAIR, // or public key
    });
    const routeMap = jupiter.getRouteMap();
    const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[ENV])).json(); // Fetch token list from Jupiter API


    // One route (optimal route provided by jupiter)
    const routes = await getRoutes({
        jupiter,
        inputToken: inToken,
        outputToken: inToken,
        inputAmount: AMOUNT, // 1 unit in UI
        slippage: .1, // .1% slippage
    });

    const bestRoute = routes!.routesInfos[0];
    const oneLegProfit = bestRoute.outAmountWithSlippage - bestRoute.inAmount;

    // Calculate best routes to all other pairs that can be swapped for token

    interface multiRouteInfo {
        profit: number;
        routes: RouteInfo[];
    }

    let maxProfitMultiRoute: multiRouteInfo | undefined;

    for (const token of tokens) {
        if (new Set((routeMap.get(token.address) || [])).has(inToken!.address)) {
            const outputToken = tokens.find((f) => f.address === token.address);

            const inRoute = await getRoutes({
                jupiter,
                inputToken: inToken,
                outputToken,
                inputAmount: AMOUNT,
                slippage: .1,
            })

            const bestInRoute = inRoute!.routesInfos[0];

            const outRoute = await getRoutes({
                jupiter,
                inputToken: outputToken,
                outputToken: inToken,
                inputAmount: bestInRoute.outAmountWithSlippage,
                slippage: .1,
            })

            const bestOutRoute = outRoute!.routesInfos[0];

            const profit = bestOutRoute.outAmountWithSlippage - bestInRoute.inAmount;
            console.log(`Found multi route with profit ${profit}`);

            if (maxProfitMultiRoute == undefined || profit > maxProfitMultiRoute.profit) {
                maxProfitMultiRoute = {
                    profit: profit,
                    routes: [bestInRoute, bestOutRoute]
                }
            }

        }
    }

    let bestRouteInfo = maxProfitMultiRoute;
    /*
    if (maxProfitMultiRoute == undefined || maxProfitMultiRoute?.profit < oneLegProfit) {
        bestRouteInfo = {
            profit: oneLegProfit,
            routes: [bestRoute]
        }
    }
    */

    return bestRouteInfo;
}
