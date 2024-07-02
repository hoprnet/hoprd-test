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
const metric_keys = ['data_received', 'data_sent', 'hopr_message_requests_succeed', 'hopr_message_requests_failed', 'hopr_sent_messages_succeed','hopr_message_latency'];

metrics = Object.entries(data.metrics).filter(([key, metric]) => {
  if(metric_keys.includes(key)) {
    return true;
  }
}).map(([key, metric]) => {
  if(key === 'data_received' || key === 'data_sent') {
    metric = {
      count: `${(metric.count / (1024 * 1024)).toFixed(2)} MB`,
      rate: `${(metric.rate / 1024).toFixed(2)} KB/s`,
      thresholds: metric.thresholds
    }
  }
  if(key === 'hopr_message_requests_succeed' || key === 'hopr_message_requests_failed' || key === 'hopr_sent_messages_succeed') {
    metric = {
      count: metric.count > 1000 ? `${(metric.count / 1000).toFixed(2)} K` : metric.count,
      rate: `${metric.rate.toFixed(2)} req/s`,
      thresholds: metric.thresholds
    }
  }
  if(key === 'hopr_message_latency') {
    metric = {
      min: metric.min > 1000 ? `${(metric.min / 1000).toFixed(2)} sec` : `${metric.min.toFixed(2)} ms`,
      max: metric.max > 1000 ? `${(metric.max / 1000).toFixed(2)} sec` : `${metric.max.toFixed(2)} ms`,
      avg: metric.avg > 1000 ? `${(metric.avg / 1000).toFixed(2)} sec` : `${metric.avg.toFixed(2)} ms`,
      "p(95)": metric['p(95)'] > 1000 ? `${(metric['p(95)'] / 1000).toFixed(2)} sec` : `${metric['p(95)'].toFixed(2)} ms`,
      "p(90)": metric['p(90)'] > 1000 ? `${(metric['p(90)'] / 1000).toFixed(2)} sec` : `${metric['p(90)'].toFixed(2)} ms`,
      thresholds: metric.thresholds
    }
  }

  if (metric.thresholds) {
    let thresholds = Object.entries(metric.thresholds).map(([threshold_name, threshold_status]) => {
      if (threshold_status === true) { // Red
        return `<span style="background-color: #ff7f7f;">${threshold_name}</span>`;
      } else { // Green
        return `<span style="background-color: #90ee90;">${threshold_name}</span>`;
      }
    });
    delete metric.thresholds;
    metric.Thresholds = thresholds.join(' | ');
  } else {
    metric.Thresholds = "N/A";
  }

  return { Metric: key, ...metric };
});











const keysCounter = ['Metric', 'count', 'rate', 'Thresholds'];
const keysTrend = ['Metric', 'min', 'max', 'avg', 'p(95)', 'p(90)', 'Thresholds'];

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
        <td style="border: 1px solid black; padding: 10px; {{#if @first}}width: 400px;{{/if}}">{{{lookup ../this this}}}</td>
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
<table style="border: 2px solid black; border-collapse: collapse;"><tbody>
  <tr><td style="border: 1px solid black;">Network</td><td style="border: 1px solid black;">${network}</td></tr>
  <tr><td style="border: 1px solid black;">Workload</td><td style="border: 1px solid black;">${workload_name}</td></tr>
  <tr><td style="border: 1px solid black;">Test Scenario</td><td style="border: 1px solid black;">${test_scenario}</td></tr>
  <tr><td style="border: 1px solid black;">Itreations</td><td style="border: 1px solid black;">${scenario_iterations}</td></tr>
  <tr><td style="border: 1px solid black;">Duration</td><td style="border: 1px solid black;">${duration}</td></tr>
  <tr><td style="border: 1px solid black;">End time</td><td style="border: 1px solid black;">${execution_time}</td></tr>
</tbody></table>
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