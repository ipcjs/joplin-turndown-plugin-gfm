const path = require('path')
const Attendant = require('turndown-attendant')
const TurndownService = require('turndown')
const gfm = require('../lib/turndown-plugin-gfm.cjs').gfm

const attendant = new Attendant({
  file: path.join(__dirname, 'index.html'),
  TurndownService,
  beforeEach: function (turndownService) {
    turndownService.use(gfm)
  }
})

attendant.run()
