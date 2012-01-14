var protocol = 'http';
var address = '127.0.0.1';
var port = 1337;

var config = { 
    start: new Date(), 
    protocol: protocol, 
    address: address, 
    port: port
};

// Handler for HTTP GET verb
function http_GET(request, response, callback) {

    if(request.url)
    {
        // Mediate query back to collector
        // If everything's good... 
        // 200 OK with result in body
        // set content-type to JSON
        
        //response.writeHead(200, {'Content-Type': 'application/json'});
        //response.write(JSON.stringify(result));
        //response.close();
        
        // otherwise... 204 NoContent
        //response.statusCode = 204;        
        //callback(response);
        
        // or "pending"
        // TODO: Implement GET verb...        
        response.statusCode = 501;        
        callback(response);
    }
    else
    {
        // Can't GET without a URL, so return "405 Method Not Allowed"
        response.statusCode = 405;
        callback(response);
    }
};

// Handler for HTTP POST verb
function http_POST(request, response, callback)  {        
    if(request.url)
    {
        // Can't POST to an URL, so return "405 Method Not Allowed"
        response.statusCode = 405;
        callback(response);
    }
    else
    {
        var val = '';
        
        request.on('data', function(chunk) {
            val += chunk;
            });
            
        request.on('end', function() { 
            var request_data =  JSON.parse(val);
            
            // generate an ID
            // create a collection handle on the collector
            // create a divide task and push to the broker
            // build url of http://<location>/<id> and put in location header
            // return 201 Created
            
            //response.statusCode = 201;
            //callback(response);
            
            // TODO: Finish implemention off POST verb...
            response.statusCode = 501;        
            callback(response);   
        });
    }

 
};

// Handler for HTTP DELETE verb
function http_DELETE(request, response, callback)  {

    // TODO: Implement DELETE verb...
    response.statusCode = 501;        
    callback(response);
};

// setup protocol handler

if(protocol == 'http') { 
    var http = require('http');
    var server = http.createServer(function (request, response) {
        
        console.log("REQ: " + request.method + " " + request.url);
        console.log(request.headers);
        function end_request(response) {
            response.end();
            console.log("REP: " + response.statusCode);
        };
        
        switch(request.method) {
            case 'GET':
                http_GET(request, response, end_request);
                break;
            case 'POST':
                http_POST(request, response, end_request);
                break;
            case 'DELETE':
                http_DELETE(request, response, end_request);
                break;
            default:
                response.statusCode = 405;
                end_request(response);
                break;                
            }
        }).listen(port, address);    
}
else if(protocol == 'tcp')
{
    console.log('TCP/IP not yet implemented');
    process.exit();
}

// announce config
console.log('Server running at ' + protocol + '://' + address + ':' + port + '/');