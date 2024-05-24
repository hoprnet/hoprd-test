const fs = require('fs');
const Handlebars = require('handlebars');

// Execution details
// node parse-results.js ${json_file} ${ENVIRONMENT_NAME} ${WORKLOAD_NAME} ${SCENARIO_ITERATIONS} ${TESTID} ${DURATION}
// node parse-results.js test-execution-20240522-113543.json rotsee sanity-check 1 test-2.1.0 30
const test_result_json = process.argv[2];
const network = process.argv[3];
const workload_name = process.argv[4];
const scenario_iterations = process.argv[5];
const test_scenario = process.argv[6];
const duration = process.argv[7];
const execution_time = test_result_json.replace(/test-execution-/, '').replace(/\.json/, '');
// Read and parse the JSON file
const data = JSON.parse(fs.readFileSync(test_result_json, 'utf8'));
const keysCounter = ['Metric', 'count', 'rate', 'Thresholds'];
const keysTrend = ['Metric', 'min', 'max', 'avg', 'p(95)', 'p(90)', 'Thresholds'];
// Extract the metrics data
metrics = Object.entries(data.metrics).map(([key, metric]) => {

  if (metric.thresholds) {
    let thresholds = Object.entries(metric.thresholds).map(([threshold_name, threshold_status]) => {
      if (threshold_status === true) {
        return `<span style="background-color: #ff7f7f;">${threshold_name}</span>`;
      } else {
        return `<span style="background-color: #90ee90;">${threshold_name}</span>`;
      }
    });
    delete metric.thresholds;
    metric.Thresholds = thresholds.join(' | ');
  } else {
    metric.Thresholds = "N/A";
  }
  // Truncate values to 4 decimal places
  for (let prop in metric) {
    if (typeof metric[prop] === 'number' && metric[prop] !== Math.floor(metric[prop])) {
      metric[prop] = metric[prop].toFixed(2);
    }
  }
  return { Metric: key, ...metric };
});

// Sort the metrics by name
metrics.sort((a, b) => {
  const metricA = a.Metric.toUpperCase(); // ignore upper and lowercase
  const metricB = b.Metric.toUpperCase(); // ignore upper and lowercase
  if (metricA < metricB) {
    return -1;
  } else {
    return 1;
  }
});

const countMetrics =  Object.values(metrics).filter((metric) => 'count' in metric);
const trendMetrics =  Object.values(metrics).filter((metric) => 'avg' in metric);
// Define the Handlebars template
const template = `
<table style="border: 2px solid black; border-collapse: collapse;">
  <thead>
    <tr>
      {{#each keys}}
      <th style="text-align: left; border: 1px solid black; padding: 10px; {{#if @first}}width: 400px;{{/if}}">{{this}}</th>
      {{/each}}
    </tr>
  </thead>
  <tbody>
    {{#each metrics}}
      <tr style="border: 1px solid black;">
        {{#each ../keys}}
        <td style="border: 1px solid black; padding: 10px; {{#if @first}}width: 400px;{{/if}}">{{lookup ../this this}}</td>
        {{/each}}
      </tr>
    {{/each}}
  </tbody>
</table>
`;

// Compile the template
const compile = Handlebars.compile(template);

// Apply the template to the metrics data
const counterHtml = compile({keys: keysCounter, metrics: countMetrics});

// Apply the template to the metrics data
const trendrHtml = compile({keys: keysTrend, metrics: trendMetrics});

const mainTemplate = `
<html>
<h1>Load Testing results</h1>
<h3>Details</h3>
<ul>
  <li>Network: ${network}</li>
  <li>Workload: ${workload_name}</li>
  <li>Test Scenario: ${test_scenario}</li>
  <li>Itreations: ${scenario_iterations}</li>
  <li>Duration: ${duration}</li>
  <li>End time: ${execution_time}</li>
</ul>
<h3>Counters</h3>
${counterHtml}
<br>
<h3>Trends</h3>
${trendrHtml}
</html>
`;

// Write the resulting HTML to a file
fs.writeFileSync(`test-execution-${execution_time}.html`, mainTemplate);
//console.log(mainTemplate);