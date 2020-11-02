var background = chrome.extension.getBackgroundPage();
var Vars = background.Vars;
var Consts = background.Consts;
var Chart;
var YearViewData = {}; // data must be string, dataExample = `{"2020-08-01": {"items": ["banana", "apple"]}, "2020-09-01": {"items": ["orange"]}}`;
var chartData = { dates: [], pomodoros: [], hours: [], weekdays: [] };


window.onload = function () {
    
    
    //collect Histogrm data
    for (var key in Vars.Histogram) {
        if (Vars.Histogram.hasOwnProperty(key)) {
            var data = Vars.Histogram[key];
            chartData.dates.push(key);
            chartData.weekdays.push(data.weekday)
            chartData.pomodoros.push(data.pomodoros);
            var hrs = data.minutes <= 0 ? 0 : (data.minutes / 60).toFixed(1);
            chartData.hours.push(hrs);
            YearViewData[key] = {"items":[`${data.pomodoros} Pomodoros`]}
        }
    }

    //History Chart
    const Canvas = document.getElementById('Chart1').getContext('2d');
    const progress = document.getElementById('animationProgress');
    Chart = new Chart(Canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: "",
                data: [],
                backgroundColor: "#87819091"
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            animation: {
                onProgress: function (animation) {
                    progress.value = animation.animationObject.currentStep / animation.animationObject.numSteps;
                }
            }
        }
    });

    Chart.data.labels = chartData.dates;
    Chart.data.datasets[0].data = chartData.pomodoros;
    Chart.data.datasets[0].label = "Pomodoros";
    Chart.options.tooltips.callbacks.title = function (tooltipItem, data) {
        return tooltipItem[0].label + " " + chartData.weekdays[chartData.dates.indexOf(tooltipItem[0].label)];
    }
    Chart.options.tooltips.callbacks.afterTitle = function (tooltipItem, data) {
        return chartData.hours[chartData.dates.indexOf(tooltipItem[0].label)] + " Hours";
    }
    Chart.update();

    // Year View heatmap graph
    console.log(YearViewData)
    $('#calendarView').calendar_yearview_blocks({
        data: JSON.stringify(YearViewData),
        start_monday: true,
        always_show_tooltip: true,
        colors: YearViewColors()
    });
}

function YearViewColors(){
    var colors = {'default': '#eeeeee'}
    for (i=1; i<100; i++){
        colors[`${i} Pomodoros`] = `rgb(255 0 0 / ${10*i}%)`;
    }
    return colors;
}

