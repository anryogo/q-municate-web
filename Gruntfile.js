'use strict';

var SERVER_PORT = 9000;

// # Globbing

module.exports = function(grunt) {
    var sass = require('node-sass');

    // configurable paths
    var settings = {
        app: 'app',
        dist: 'dist',
        originalScriptTag: '<script src="scripts/main.js"></script>',
        tmpScriptTag: '<script src="scripts/.build.js"></script>'
    };

    // show elapsed time at the end
    require('time-grunt')(grunt);
    // load all grunt tasks
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        settings: settings,
        pkg: grunt.file.readJSON('bower.json'),
        banner: '/* <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %> */\n',

        clean: {
            dev: ['.css', '.tmp', '<%= settings.app %>/.css'],
            dist: ['.css', '.tmp', '<%= settings.app %>/.css',
                '<%= settings.dist %>/scripts', '<%= settings.dist %>/styles', '<%= settings.dist %>/vendor', '<%= settings.dist %>/workers'
            ],
            tmpBuild: ['<%= settings.app %>/scripts/.build.js'],
            tails: ['<%= settings.dist %>/_index.html']
        },

        sass: {
            options: {
                implementation: sass,
                sourceMap: true
            },
            dist: {
                files: {
                    '<%= settings.app %>/.css/main.css': '<%= settings.app %>/styles/main.scss'
                }
            }
        },

        handlebars: {
            compile: {
                options: {
                    namespace: 'JST',
                    amd: true
                },
                files: {
                    '.tmp/scripts/templates.js': ['<%= settings.app %>/scripts/templates/*.hbs']
                }
            }
        },

        bower: {
            all: {
                rjsConfig: '<%= settings.app %>/scripts/main.js',
                options: {
                    exclude: ['jquery', 'modernizr', 'requirejs']
                }
            }
        },

        requirejs: {
            dist: {
                options: {
                    baseUrl: '<%= settings.app %>/scripts',
                    mainConfigFile: "<%= settings.app %>/scripts/main.js",
                    name: 'main',
                    optimize: 'none',
                    out: "<%= settings.app %>/scripts/.build.js",

                    paths: {
                        'templates': '.tmp/scripts/templates'
                    },

                    almond: false,
                    preserveLicenseComments: false
                }
            }
        },

        watch: {
            options: {
                spawn: false
            },
            css: {
                files: ['<%= settings.app %>/styles/{,*/}*.scss'],
                tasks: ['sass']
            },
            handlebars: {
                files: [
                    '<%= settings.app %>/scripts/templates/*.hbs'
                ],
                tasks: ['handlebars']
            }
        },

        useminPrepare: {
            html: '<%= settings.app %>/index.html',
            options: {
                dest: '<%= settings.dist %>'
            }
        },

        cssmin: {
            options: {
                banner: '<%= banner %>'
            }
        },

        uglify: {
            options: {
                banner: '<%= banner %>'
            }
        },

        imagemin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= settings.app %>/images',
                    src: '{,*/}*.{png,jpg,jpeg,svg,gif}',
                    dest: '<%= settings.dist %>/images'
                }]
            }
        },

        htmlmin: {
            dist: {
                files: {
                    '<%= settings.dist %>/_index.html': '<%= settings.app %>/index.html'
                }
            },
            min: {
                options: {
                    collapseWhitespace: true,
                    minifyCSS: true,
                    minifyJS: true
                },
                files: {
                    '<%= settings.dist %>/index.html': '<%= settings.dist %>/_index.html',
                    '<%= settings.dist %>/404.html': '<%= settings.app %>/404.html'
                }
            }
        },

        rev: {
            dist: {
                files: {
                    src: [
                        '<%= settings.dist %>/scripts/{,*/}*.js',
                        '<%= settings.dist %>/styles/{,*/}*.css',
                        '<%= settings.dist %>/vendor/{,*/}*.js',
                    ]
                }
            }
        },

        usemin: {
            html: ['<%= settings.dist %>/{,*/}*.html'],
            options: {
                dirs: ['<%= settings.dist %>']
            }
        },

        copy: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= settings.app %>',
                    src: [
                        '*.{ico,png}',
                        'audio/{,*/}*.*',
                        'workers/{,*/}*.js'
                    ],
                    dest: '<%= settings.dist %>'
                }, {
                    expand: true,
                    cwd: '<%= settings.app %>',
                    src: [
                        'bower_components/quickblox/quickblox.min.js',
                        'bower_components/firebase/firebase.js'
                    ],
                    dest: '<%= settings.dist %>'
                }]
            }
        },

        connect: {
            options: {
                protocol: 'https',
                port: grunt.option('port') || SERVER_PORT,
                open: true,
                // change this to '0.0.0.0' to access the server from outside
                hostname: 'localhost'
            },
            dev: {
                options: {
                    base: [
                        '.tmp',
                        '<%= settings.app %>'
                    ]
                }
            },
            dist: {
                options: {
                    protocol: 'https',
                    base: '<%= settings.dist %>'
                }
            }
        },

        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish')
            },
            all: [
                'Gruntfile.js',
                '<%= settings.app %>/scripts/{,*/}*.js',
                '!<%= settings.app %>/vendor/*'
            ]
        },

        includereplace: {
            prod: {
                options: {
                    globals: {
                        appId: '13318',
                        authKey: 'WzrAY7vrGmbgFfP',
                        authSecret: 'xS2uerEveGHmEun',
                        debugQM: '0',
                        debugQB: '0'
                    }
                },
                src: '<%= settings.app %>/configs/environment.js',
                dest: '<%= settings.app %>/configs/main_config.js'
            },
            dev: {
                options: {
                    globals: {
                        appId: '76743',
                        authKey: 'exCV7U-V4BY-t4X',
                        authSecret: '6zYUFGZFQFWmL3v',
                        debugQM: '1',
                        debugQB: '1'
                    }
                },
                src: '<%= settings.app %>/configs/environment.js',
                dest: '<%= settings.app %>/configs/main_config.js'
            },
            local: {
                src: '<%= settings.app %>/config.js',
                dest: '<%= settings.app %>/configs/main_config.js'
            }
        }
    });

    var envTarget = grunt.option('env') || 'local';

    grunt.registerTask('createDefaultTemplate', function() {
        grunt.file.write('.tmp/scripts/templates.js', 'this.JST = this.JST || {};');
    });

    grunt.registerTask('createTmpScriptTag', function(rollBack) {
        var path = settings.app + '/index.html';
        var indexFile = grunt.file.read(path);
        if (typeof rollBack === 'undefined') {
            grunt.file.write(path, indexFile.replace(settings.originalScriptTag, settings.tmpScriptTag));
        } else {
            grunt.file.write(path, indexFile.replace(settings.tmpScriptTag, settings.originalScriptTag));
            grunt.task.run(['clean:tmpBuild']);
        }
    });

    grunt.registerTask('server', function(target) {
        grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
        grunt.task.run(['serve' + (target ? ':' + target : '')]);
    });

    grunt.registerTask('serve', function(target) {
        if (target === 'dist') {
            return grunt.task.run(['build', 'connect:dist:keepalive']);
        }

        /***********************************************************************
         1) task - "grunt serve"
         > use configs from ../q-municate-web./app/config.js

         2) task - "grunt serve --env=dev"
         > use configs from ../q-municate-web./app/configs/environments.js and set DEV environment

         3) task - "grunt serve --env=prod"
         > use configs from ../q-municate-web./app/configs/environments.js and set PROD environment
         ***********************************************************************/
        grunt.task.run([
            'includereplace:' + envTarget,
            'clean:dev',
            'sass',
            'createDefaultTemplate',
            'handlebars',
            'connect:dev',
            'watch'
        ]);
    });

    /***************************************************************************
     1) task - "grunt build"
     > use configs from ../q-municate-web./app/config.js

     2) task - "grunt build --env=dev"
     > use configs from ../q-municate-web./app/configs/environments.js and set DEV environment

     3) task - "grunt build --env=prod"
     > use configs from ../q-municate-web./app/configs/environments.js and set PROD environment
     ***************************************************************************/
    grunt.registerTask('build', [
        'jshint',
        'includereplace:' + envTarget,
        'clean:dist',
        'sass',
        'createDefaultTemplate',
        'handlebars',
        'requirejs',
        'createTmpScriptTag',
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'newer:imagemin',
        'htmlmin',
        'rev',
        'usemin',
        'newer:copy',
        'createTmpScriptTag:rollBack',
        'htmlmin:min',
        'clean:tails'
    ]);

    grunt.registerTask('default', ['build']);
    grunt.registerTask('test', ['jshint']);

};
