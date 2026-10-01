// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// pluginID must match the id in src/plugin.json. The SDK reads it only to find
// the address of a standalone debug server, so a mismatch does not stop the
// plugin from loading under Grafana; it only breaks that debugging mode.
const pluginID = "axiumine-redis-datasource"

// manage and exit are backend.Manage and os.Exit, held in variables so that the
// tests can run main without serving Grafana or ending the test process.
var (
	manage = backend.Manage
	exit   = os.Exit
)

/**
 * Start listening to requests send from Grafana.
 * This call is blocking so it wont finish until Grafana shutsdown the process or the plugin choose to exit close down by itself
 */
func main() {
	err := manage(pluginID, newDatasource())

	// Log any error if we could start the plugin.
	if err != nil {
		log.DefaultLogger.Error(err.Error())
		exit(1)
	}
}
