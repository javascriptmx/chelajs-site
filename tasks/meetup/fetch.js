var grunt = require('grunt');

grunt.registerTask(
  'meetup:rsvp:fetch',
  'descarga la lista de asistentes',
  function FetchGuestlist () {
    var Evento = require('../../lib/evento'),
        fs = require('fs'),
        low = require('lowdb'),
        db = low('db.json'),
        _ = require('lodash'),
        Meethub = require('meethub'),
        cache;

    var cfg = JSON.parse(fs.readFileSync('config.json'));
    var mh = new Meethub(cfg, Evento);
    var rsvp_daemon = require('../../lib/rsvp_daemon');

    var event = Evento.decorate(
      db('events')
      .chain()
      .sortBy('starts')
      .reverse()
      .take(1)
      .value()[0]);

    grunt.log.writeln('Obteniendo meetup#'+event.meetup_id);

    var cache_path = "./tmp/"+event.meetup_id+"-rsvp.json";
    try {
      cache = JSON.parse(fs.readFileSync(cache_path));
      cache.starts = new Date(cache.starts);
    } catch (err) {
      grunt.log.writeln(err);
      grunt.log.writeln("Generando archivo nuevo");
      cache = {
        id: event.meetup_id,
        name: event.name,
        starts: event.starts,//.toISOString(),
        people: []
      };
    }

    var hosts = _.filter(cache.people, {_role: 'host'});
    hosts = (hosts.length > 0) ? _.pluck(hosts, 'id') : cfg.meetup.defaults.hosts;
    var speakers = _.pluck(speakers, _.filter(cache.people, {_role: 'speaker'}), 'id');
    cache.people = _.indexBy(cache.people, 'id');


    var done = this.async();
    mh.meetup.getRSVPs({event_id: event.meetup_id.toString()}, function(err, res) {
      res.results.forEach(function (rsvp) {
        var mid = rsvp.member.member_id;
        var data = rsvp_daemon.parse(rsvp, cache.people[mid], hosts);
        cache.people[mid] = data;
      });

      cache.people = _.sortByAll(_.values(cache.people), ['_role', 'name.last', 'name.first']);

      fs.writeFile(cache_path, JSON.stringify(cache), 'utf-8', function (err) {
        if (err) throw err;
        grunt.log.writeln('Archivo guardado en '+cache_path);
        done();
      });
    });
  }
);