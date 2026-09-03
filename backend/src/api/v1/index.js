import { Router } from 'express';

import daoRoutes      from './daos/dao.routes.js';
import guildRoutes    from './guilds/guild.routes.js';
import proposalRoutes from './proposals/proposal.routes.js';
import chatRoutes     from './chat/chat.routes.js';
import feedRoutes     from './feed/feed.routes.js';
import tokenRoutes    from './tokens/token.routes.js';
import swapRoutes     from './swap/swap.routes.js';
import lifiRoutes     from './lifi/lifi.routes.js';
import coingeckoRoutes from './coingecko/coingecko.routes.js';
import mintRoutes     from './mint/mint.routes.js';
import uploadRoutes   from './upload/upload.routes.js';
import miniappRoutes  from './miniapps/miniapp.routes.js';

const router = Router();

router.use(daoRoutes);
router.use(guildRoutes);
router.use(proposalRoutes);
router.use(chatRoutes);
router.use(feedRoutes);
router.use('/tokens', tokenRoutes);
router.use('/swap', swapRoutes);
router.use('/lifi', lifiRoutes);
router.use('/coingecko', coingeckoRoutes);
router.use(mintRoutes);
router.use(uploadRoutes);
router.use(miniappRoutes);

export default router;
