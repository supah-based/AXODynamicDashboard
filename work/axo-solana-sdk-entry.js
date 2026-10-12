import {createSolanaClient} from '@metamask/connect-solana';import bs58 from 'bs58';export {createSolanaClient};export const signatureText=bytes=>bs58.encode(bytes);
