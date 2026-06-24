// A generic sample page that exercises the trickier blocks — in particular a nested
// `pymdownx.blocks.html` table (a sub-table inside the `services` cell), which is the
// case plain Excel-style table editors can't represent.
export const SAMPLE = `## Configuration file fields

The configuration file is a YAML document that describes your deployment.

/// html | table
//// html | th[style='text-align: center;']
Top-level parameter
////
//// html | th[style='text-align: center;']
Description
////

//// html | tr
///// html | td
\`version\`
/////
///// html | td
The schema version of the configuration file.
Example: \`1.4\`
/////
////

//// html | tr
///// html | td
\`name\`
/////
///// html | td
A human-readable name for the deployment.
Example: \`production\`
/////
////

//// html | tr
///// html | td
\`services\`
/////
///// html | td
A list of services to run. Each service has the following settings:

////// html | table

/////// html | tr
//////// html | td
\`image\`
////////
//////// html | td
The container image to deploy.
Example: \`registry.example.com/app:latest\`
////////
///////

/////// html | tr
//////// html | td
\`port\`
////////
//////// html | td
The port the service listens on. Optional.
////////
///////

//////
/////
////
///

After the table, normal prose continues here.

/// note | Heads up
Keep the configuration file in version control so changes are reviewable.
///

## Generating the configuration

/// tab | Quick start

--8<-- "docs/resources/config-example.yaml"
///

/// tab | Custom registry

--8<-- "docs/resources/config-example.yaml"

\`\`\`yaml
registry:
  url: https://registry.example.com
  insecure: false
\`\`\`
///

/// details | Advanced options
Set \`--reload-interval\` to change how often the configuration is re-read.
///
`
