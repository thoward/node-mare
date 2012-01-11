
node-mare
=========

*node-mare* is a map-reduce style distributed execution framework for node.js

Huh? Could you 'splain that to me?
----------------------------------

Let's break that down into something more exampley. What *node-mare* lets you do is take a big chunk of work divide it into smaller chunks of work, executing each small chunk on a separate machine (or same machine different node process, whatever), then collect up the results of that processing into a high-level result. 

It allows you to pass your data as JSON and arbitrary Javascript code for dividing, processing and aggregating. It scales horizontally with minimal configuration and it operates entirely over HTTP with JSON. Who knows, it might even be RESTful. 

I say that because I haven't written it yet. This is step one: the plan. If you're reading this document then that's all there is so far; a plan. Once I implement it, I'll update this document and tell you exactly what it is and isn't. 

How It Works
------------

Let's get into some details of how this thing will work. There will be a few different moving parts but first, lets talk about a problem that we want to solve and then talk about how we'll solve it using this library.

Here's a problem in some client code. We want to know the frequency of terms starting with the letter 'a' in a given blob of text. This is the unsexy, imperative, sequential way to do this:

```javascript
    
    var get_words = function(sentence) { 
        // divide sentence into words
        return sentence.split(/\W+/);
    };

    var word_to_term = function(word) {       
        // if the word is longer than 3 chars and starts with a
        // convert to lower case and return... else null;
        word = word.toLowerCase();
        if (word.length > 3 && word.lastIndexOf('a', 0) === 0) {
            return word;
        }
        return null;
    };

    var collect_term_freq = function(result, term) {
        // keep a unique list of results and count the 
        // times a term occurs in the sentence
        if (null == term) return;
        
        if(term in result) {
            // increment term count
            result[term] += 1;
        }
        else {
            // add term
            result[term] = 1;
        }    
    };

    
    var unsexy = function(params) { 
        // unsexy (non-mappy-reducey-distributedy) way to perform this operation:
        var units_of_work = params.divide(data);
        
        for(var i in units_of_work) {    
            var unit_result = params.process(units_of_work[i])
            params.collect(params.result, unit_result);
        }
        
        return params.result;
    };

    var data = "Alex and Andrea left for the arcade. Alex ate pizza. Andrea doesn't like anchovies.";

    var term_freqs = [];
    
    unsexy({
        data: data,
        divide: get_words,
        process: word_to_term,
        collect: collect_term_freq,
        result: term_freqs
    });

    // result == [alex: 2, andrea: 2, arcade: 1, anchovies: 1]

```

This works just fine. Go ahead and paste it into your node REPL to see it in all it's glorious action. But what if that blob of text was HUGE or there were say... 10 million of them to process. This clearly will not scale.

In *node-mare* this will be done via an instance of the client. Eg:

```javascript
   
    var client = node-mare.Client("127.0.0.1:1337");
    
    client.execute({ 
        data: data, 
        divide: get_words, 
        process: word_to_term, 
        collect: collect_term_freq, 
        result: term_freqs
    });
   
```

This will send the request off to http://127.0.0.1:1337/task . It will serialize the data, result object and functions (back to thier source code) and pass it all to the server. The server will then queue up the *get_words(sentence)* method to be executed on one of many waiting workers. That worker will take the results of *get_words* (units_of_work in our unsexy example) and queue up *word_to_term(word)* to be executed on many instances. The results of that operation will be posted to a collector that will execute *term_freqs* and maintain the state of result. Finally, it will return the result to the client and thus, to your code. 

Orchestrating all this is a bit tricky, so lets talk about the actual HTTP endpoints and how it will all fit together.

node-mare.server
----------------

A server process that communicates over HTTP to interact with the client.

It has the following methods:

* */task* [POST] - Queues up a job. 

  You'd put your JSON parameter in the POST body. It will return 201 Created and put a /task/{id} URI in the location header.
  
* */task/{id}* [GET] - Poll for job completion or return the results. 

  It will return 204 No Content while the task is processing then 200 OK after the task is complete and the result set is available. Unfortunately yes, this means the client-side is going to have to poll this endpoint while waiting. It'll have a timeout. We'll fix this later.

node-mare.broker
----------------

A server process that communicates over HTTP to interact with the server and workers.

It has the following methods:

* */task* [POST] - Queues up a divide job. 

  POST body contains { data: ..., type: ..., method: ...}, but the broker only looks at type. The parameters *data* and *method* are from initial node-mare.server/task POST and *type* is either 'divide' or 'process'. Later a node-mare.worker will get this task and execute it. More on that in that section. It will return 201 Created with a ~broker/task/{id} location header on success or some error code on failure. 

* */queue* [GET] - Returns all queued tasks but does not remove them from the queue
* */queue?count={n}* [GET] - Returns all queued tasks but does not remove them from the queue
* */queue* [POST] - Returns the top task and *removes it from the queue*
* */queue?count={n}* [POST] - Returns the top n tasks and *removes them from the queue*
* */worker*  [POST] - Registers a worker with the broker. 
  
  The broker pushes notifications out to the workers, so the first thing a worker needs to do when it starts up is register itself with the broker. Worker should post in the body a JSON object:

  ,,,javascript 
    { 
        address: ..., // IP Address
        types: [...], // list of job types it can accept eg "divide", "process", etc... 
    }
  ,,,

* */worker*  [GET] - Returns all registered workers.
* */worker/{id}*  [GET] - Returns all registered workers.

node-mare.worker
----------------

A server process that communicates over HTTP to interact with the broker and collector.

It has the following methods:

* */notify* [POST] - Notifies the worker that a task of a given type is available on the broker.

  POST body contains:
  
  ,,,javascript
      { 
          address: ..., // broker's ip address
          type: ...     // type of task
      }
  ,,,

  It will return 204 No Content on success or some error code on failure. 

node-mare.collector
-------------------

A server process that communicates over HTTP to interact with the workers and server.

It has the following methods:

* */result* [POST] - Initializes the result slot on the collector

  POST body contains:
  
  ,,,javascript
      { 
          id: ...,        // the id for the task (originally generated by the server)
          result: ...,    // the result object in it's initialized state
          collect: ...,   // the method used to collect result data
          timeout: ...,   // how long (in ms) to wait for completion of this result set
      }
  ,,,

  It will return 204 No Content on success or some error code on failure. 

* */result/{id}?expect={n}* [POST] - Posts an amount n of results the collector should expect for id

   This is called by the worker after processing a divide task. 
   
* */result/{id}* [POST] - Posts a unit of data to be collected

  POST body contains:
  
  ,,,javascript
      { 
          data: ...      // the individual unit of data to collect
      }
  ,,,

  It will return 204 No Content on success or some error code on failure. 

* */result/{id}* [GET] - Returns a unit of data to be collected

  POST body contains:
  
  ,,,javascript
      { 
          data: ...      // the individual unit of data to collect
      }
  ,,,

  It will return 204 No Content on success or some error code on failure. 
