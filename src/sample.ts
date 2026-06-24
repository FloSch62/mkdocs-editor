// A trimmed excerpt of the real "menace": the EDAADM configuration file fields table from
// nokia-eda/docs (setting-up-the-eda-virtual-machine-nodes.md). Includes a nested sub-table
// inside the `machines` cell — the case Excel-style editors can't represent.
export const SAMPLE = `## EDAADM configuration file fields

The EDAADM configuration file is a YAML file that describes your Talos Kubernetes environment.

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
The version of the Nokia EDA environment to be deployed.
Example: 25.4.1
/////
////

//// html | tr
///// html | td
\`clusterName\`
/////
///// html | td
The name of your Nokia EDA environment.
Example: \`eda-production-cluster\`
/////
////

//// html | tr
///// html | td
\`machines\`
/////
///// html | td
A list of Kubernetes nodes. Each Kubernetes node has the following settings:

////// html | table

/////// html | tr
//////// html | td
\`name\`
////////
//////// html | td
The name of a node.
Example: \`eda-node01\`
////////
///////

/////// html | tr
//////// html | td
\`endpoint\`
////////
//////// html | td
The IP address on which the node is reachable for Talos to control. Optional.
////////
///////

//////
/////
////
///

After the table, normal prose continues here.

/// note | Heads up
The \`edaadm\` tool must run with the same version as your target environment.
///

## Generating the configuration

/// tab | Internet based installation

--8<-- "docs/software-install/resources/edaadm-config-example.yaml"
///

/// tab | Air-gapped installation

--8<-- "docs/software-install/resources/edaadm-config-example.yaml"

\`\`\`yaml
mirror:
  name: 192.0.2.228
  url: https://192.0.2.228
  insecure: true
\`\`\`
///

/// details | Advanced options
Set \`--client-cert-duration\` to change the Talos client certificate lifetime.
///
`
