const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../dev.db');
const db = new Database(dbPath);

const laws = [
    {
      title: '中华人民共和国食品安全法',
      category: '食品安全',
      level: '法律',
      issueDate: '2021-04-29T00:00:00.000Z',
      content: `第一条 为了保证食品安全，保障公众身体健康和生命安全，制定本法。
第二条 在中华人民共和国境内从事下列活动，应当遵守本法：
（一）食品生产经营；
（二）食品添加剂的生产经营；
（三）用于食品的包装材料、容器、洗涤剂、消毒剂和用于食品生产经营的工具、设备（以下称食品相关产品）的生产经营；
（四）食品生产经营者使用食品添加剂、食品相关产品；
（五）食品的贮存和运输；
（六）对食品、食品添加剂、食品相关产品的安全管理。
供食用的源于农业的初级产品（以下称食用农产品）的质量安全管理，遵守《中华人民共和国农产品质量安全法》的规定。但是，食用农产品的市场销售、有关质量安全标准的制定、有关安全信息的公布和本法对农业投入品作出规定的，应当遵守本法的规定。`
    },
    {
      title: '中华人民共和国广告法',
      category: '广告监管',
      level: '法律',
      issueDate: '2021-04-29T00:00:00.000Z',
      content: `第一条 为了规范广告活动，保护消费者的合法权益，促进广告业的健康发展，维护社会经济秩序，制定本法。
第二条 在中华人民共和国境内，商品经营者或者服务提供者通过一定媒介和形式直接或者间接地介绍自己所推销的商品或者服务的商业广告活动，适用本法。
本法所称广告主，是指为推销商品或者服务，自行或者委托他人设计、制作、发布广告的自然人、法人或者其他组织。
本法所称广告经营者，是指接受委托提供广告设计、制作、代理服务的自然人、法人或者其他组织。
本法所称广告发布者，是指为广告主或者广告主委托的广告经营者发布广告的自然人、法人或者其他组织。
本法所称广告代言人，是指广告主以外的，在广告中以自己的名义或者形象对商品、服务作推荐、证明的自然人、法人或者其他组织。`
    },
    {
      title: '中华人民共和国反不正当竞争法',
      category: '公平竞争',
      level: '法律',
      issueDate: '2019-04-23T00:00:00.000Z',
      content: `第一条 为了促进社会主义市场经济健康发展，鼓励和保护公平竞争，制止不正当竞争行为，保护经营者和消费者的合法权益，制定本法。
第二条 经营者在生产经营活动中，应当遵循自愿、平等、公平、诚信的原则，遵守法律和商业道德。
本法所称的不正当竞争行为，是指经营者在生产经营活动中，违反本法规定，扰乱市场竞争秩序，损害其他经营者或者消费者的合法权益的行为。
本法所称的经营者，是指从事商品生产、经营或者提供服务（以下所称商品包括服务）的自然人、法人和非法人组织。`
    }
];

const insert = db.prepare(`
    INSERT INTO "Law" (title, category, level, issueDate, content, createdAt, updatedAt)
    VALUES (@title, @category, @level, @issueDate, @content, @createdAt, @updatedAt)
`);

const now = new Date().toISOString();

const insertMany = db.transaction((laws) => {
  for (const law of laws) {
    insert.run({ ...law, createdAt: now, updatedAt: now });
  }
});

insertMany(laws);
console.log('Seeding completed.');
db.close();
