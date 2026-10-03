import { join } from "path";
import { promises as fs } from 'fs';

let handler = async (m, { conn, args, command, usedPrefix, text }) => {
    const ctxErr = (global.rcanalx || {});
    const ctxWarn = (global.rcanalw || {});
    const ctxOk = (global.rcanalr || {});
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    const db = global.db?.data || {};
    const chatData = db.chats?.[m.chat] || {};
    
    if (!chatData.sales) chatData.sales = {};
    if (!db.characters) db.characters = {};
    if (!db.users?.[m.sender]) {
        if (!db.users) db.users = {};
        db.users[m.sender] = { coin: 0, characters: [] };
    }
    
    if (!chatData.gacha && m.isGroup) {
        return await conn.reply(m.chat, 'ꕤ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *' + usedPrefix + 'gacha on*', m, ctxWarn);
    }

    try {
        switch (command) {
            case 'vender':
            case 'sell': {
                if (args.length < 2) {
                    return await conn.reply(m.chat, 'ꕤ Debes especificar un precio para subastar el personaje.\n> Ejemplo » *' + (usedPrefix + command) + ' 5000 nombre personaje*', m, ctxErr);
                }
                
                const price = parseInt(args[0]);
                if (isNaN(price) || price < 2000) {
                    return await conn.reply(m.chat, 'ꕤ El precio mínimo para subastar un personaje es de *2,000 ' + userCurrency + '*.', m, ctxErr);
                }
                
                const characterName = args.slice(1).join(' ').toLowerCase();
                const characterId = Object.keys(db.characters).find(id => 
                    (db.characters[id]?.name || '').toLowerCase() === characterName && 
                    db.characters[id]?.user === m.sender
                );
                
                if (!characterId) {
                    return await conn.reply(m.chat, 'ꕤ No se ha encontrado al personaje *' + args.slice(1).join(' ') + '*.', m, ctxErr);
                }
                
                const character = db.characters[characterId];
                chatData.sales[characterId] = {
                    name: character.name,
                    user: m.sender,
                    price: price,
                    time: Date.now()
                };
                
                let sellerName = await (async () => {
                    try {
                        return db.users[m.sender]?.name?.trim() || 
                               (await conn.getName(m.sender)) || 
                               m.sender.split('@')[0];
                    } catch {
                        return m.sender.split('@')[0];
                    }
                })();
                
                await conn.reply(m.chat, 'ꕤ *' + character.name + '* ha sido puesto a la venta!\nꕤ Vendedor » *' + sellerName + 
                       '*\n⛁ Precio » *' + price.toLocaleString() + ' ' + userCurrency + 
                       '*\nⴵ Expira en » *3 dias*\n> Puedes ver los personajes en venta usando *' + usedPrefix + 'wshop*', m, ctxOk);
                break;
            }
            
            case 'removesale':
            case 'removerventa': {
                if (!args.length) {
                    return await conn.reply(m.chat, 'ꕤ Debes especificar un personaje para eliminar.\n> Ejemplo » *' + (usedPrefix + command) + ' nombre personaje*', m, ctxErr);
                }
                
                const characterName = args.join(' ').toLowerCase();
                const characterId = Object.keys(chatData.sales).find(id => 
                    (chatData.sales[id]?.name || '').toLowerCase() === characterName
                );
                
                if (!characterId || chatData.sales[characterId].user !== m.sender) {
                    return await conn.reply(m.chat, 'ꕤ El personaje *' + args.join(' ') + '* no está a la venta por ti.', m, ctxErr);
                }
                
                delete chatData.sales[characterId];
                await conn.reply(m.chat, 'ꕤ *' + args.join(' ') + '* ha sido eliminado de la lista de ventas.', m, ctxOk);
                break;
            }
            
            case 'wshop':
            case 'haremshop':
            case 'tiendawaifus': {
                const sales = Object.entries(chatData.sales || {});
                if (!sales.length) {
                    const groupName = await conn.getName(m.chat).catch(() => 'este grupo');
                    return await conn.reply(m.chat, 'ꕤ No hay personajes en venta en *' + groupName + '*', m, ctxWarn);
                }
                
                const page = parseInt(args[0]) || 1;
                const itemsPerPage = 10;
                const totalPages = Math.ceil(sales.length / itemsPerPage);
                
                if (page < 1 || page > totalPages) {
                    return await conn.reply(m.chat, 'ꕤ Página inválida. Solo hay *' + totalPages + '* página' + (totalPages > 1 ? 's' : '') + '.', m, ctxErr);
                }
                
                const startIdx = (page - 1) * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, sales.length);
                
                const salesList = [];
                const namePromises = [];
                
                for (let i = startIdx; i < endIdx; i++) {
                    const [characterId, saleData] = sales[i];
                    const timeLeft = 3 * 24 * 60 * 60 * 1000 - (Date.now() - saleData.time);
                    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
                    const hours = Math.floor(timeLeft % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
                    
                    const characterValue = typeof db.characters[characterId]?.value === 'number' ? 
                        db.characters[characterId].value : 0;
                    
                    namePromises.push((async (saleData, characterValue, days, hours) => {
                        let sellerName = await (async () => {
                            try {
                                return db.users[saleData.user]?.name?.trim() || 
                                       (await conn.getName(saleData.user)) || 
                                       saleData.user.split('@')[0];
                            } catch {
                                return saleData.user.split('@')[0];
                            }
                        })();
                        
                        return 'ꕤ *' + saleData.name + 
                             '*\n⛁ Valor » *' + characterValue + 
                             '*\n💰 Precio » *' + saleData.price.toLocaleString() + ' ' + userCurrency + 
                             '*\n❖ Vendedor » *' + sellerName + 
                             '*\nⴵ Expira en » *' + days + 'd ' + hours + 'h*';
                    })(saleData, characterValue, days, hours));
                }
                
                const resolvedSalesList = await Promise.all(namePromises);
                
                await conn.reply(m.chat, '*☆ HaremShop `≧◠ᴥ◠≦`*\n' + 
                       '❏ Personajes en venta <' + sales.length + '>\n\n' + 
                       resolvedSalesList.join('\n\n') + 
                       '\n\n> • Páginá *' + page + '* de *' + totalPages + '*', m, ctxOk);
                break;
            }
            
            case 'buyc':
            case 'buychar':
            case 'buycharacter': {
                if (!args.length) {
                    return await conn.reply(m.chat, 'ꕤ Debes especificar un personaje para comprar.\n> Ejemplo » *' + (usedPrefix + command) + ' nombre personaje*', m, ctxErr);
                }
                
                const characterName = args.join(' ').toLowerCase();
                const characterId = Object.keys(chatData.sales).find(id => 
                    (chatData.sales[id]?.name || '').toLowerCase() === characterName
                );
                
                if (!characterId) {
                    return await conn.reply(m.chat, 'ꕤ No se ha encontrado al personaje *' + args.join(' ') + '* en venta.', m, ctxErr);
                }
                
                const saleData = chatData.sales[characterId];
                if (saleData.user === m.sender) {
                    return await conn.reply(m.chat, 'ꕤ No puedes comprar tu propio personaje.', m, ctxErr);
                }
                
                const buyer = db.users[m.sender];
                const buyerCoins = typeof buyer?.coin === 'number' ? buyer.coin : 0;
                
                if (buyerCoins < saleData.price) {
                    return await conn.reply(m.chat, 'ꕤ No tienes suficientes *' + userCurrency + 
                                 '* para comprar a *' + saleData.name + 
                                 '*\n> Necesitas *' + saleData.price.toLocaleString() + 
                                 ' ' + userCurrency + '*', m, ctxErr);
                }
                
                const seller = db.users[saleData.user];
                if (!seller) {
                    db.users[saleData.user] = { coin: 0, characters: [] };
                }
                
                if (!Array.isArray(seller.characters)) {
                    seller.characters = [];
                }
                
                buyer.coin -= saleData.price;
                seller.coin += saleData.price;
                
                db.characters[characterId].user = m.sender;
                
                if (!buyer.characters.includes(characterId)) {
                    buyer.characters.push(characterId);
                }
                
                seller.characters = seller.characters.filter(id => id !== characterId);
                
                if (seller.favorite === characterId) {
                    delete seller.favorite;
                }
                
                delete chatData.sales[characterId];
                
                const [sellerName, buyerName] = await Promise.all([
                    (async () => {
                        try {
                            return seller.name?.trim() || 
                                   (await conn.getName(saleData.user)) || 
                                   saleData.user.split('@')[0];
                        } catch {
                            return saleData.user.split('@')[0];
                        }
                    })(),
                    (async () => {
                        try {
                            return buyer.name?.trim() || 
                                   (await conn.getName(m.sender)) || 
                                   m.sender.split('@')[0];
                        } catch {
                            return m.sender.split('@')[0];
                        }
                    })()
                ]);
                
                await conn.reply(m.chat, 'ꕤ *' + saleData.name + 
                       '* ha sido comprado por *' + buyerName + 
                       '*\n⛁ Se han transferido *' + saleData.price.toLocaleString() + 
                       ' ' + userCurrency + '* a *' + sellerName + '*', m, ctxOk);
                break;
            }
        }
    } catch (error) {
        console.error('Error en handler de tienda:', error);
        await conn.reply(m.chat, '⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + error.message, m, ctxErr);
    }
};

handler.help = [
    'vender <precio> <personaje>',
    'removesale <personaje>', 
    'wshop [página]',
    'buyc <personaje>'
];

handler.tags = ['gacha'];
handler.command = [
    'vender', 'sell', 
    'removesale', 'removerventa', 
    'haremshop', 'tiendawaifus', 'wshop', 
    'buychar', 'buycharacter', 'buyc'
];
handler.group = true;

export default handler;