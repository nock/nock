#!/usr/bin/env node

var argv = process.argv.slice(2)
  , path = require("path")
  , Runner = require("tap-runner")
  , r = new Runner(argv, null)
  , TapProducer = require("tap-producer")

if (process.env.TAP || process.env.TAP_DIAG) {
  r.pipe(process.stdout)
} else {
  r.on("file", function (file, results, details) {
    var s = (details.ok ? "" : "not ") + "ok "+results.name
      , n = details.pass + "/" + details.testsTotal
      , dots = new Array(Math.max(1, 40 - s.length - n.length)).join(".")
    console.log("%s %s %s", s, dots, n)
    if (details.ok) {
      if (details.skip) {
        console.log("  skipped: %s", details.skipTotal)
      }
    } else {
      // console.error(details)
      console.log("    Command: %s", results.command)
      console.log("    " + TapProducer.encode(details.list)
                  .split(/\n/).join("\n    "))
    }
  })
  r.on("end", function () {
    //console.log(r)
    var s = "total"
      , n = r.results.pass + "/" + r.results.testsTotal
      , dots = new Array(40 - s.length - n.length).join(".")
      , ok = r.results.ok ? "ok" : "not ok"
    console.log("%s %s %s\n\n%s", s, dots, n, ok)
    process.stdout.flush()
  })
}



r.on("end", function () {
  process.exit(r.results.tests - r.results.pass)
})
