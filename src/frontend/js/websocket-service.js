/**
 * Angular bindings for the Seashell WebSocket client.
 * Copyright (C) 2013-2014 The Seashell Maintainers.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See also 'ADDITIONAL TERMS' at the end of the included LICENSE file.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with self program.  If not, see <http://www.gnu.org/licenses/>.
 */
angular.module('websocket-service', ['jquery-cookie'])
  /**
   * WebSocket service:
   *  provides:
   *    register_disconnect_callback |
   *    register_reconnect_callback  | Callbacks to be invoked on change of socket connectivity.
   *    register_fail_callback       | 
   *    register_timein/out_callback |
   *    connect                      - Connects the socket
   *    socket                       - Socket object.  Is invalid after disconnect/fail | before connect.
   */
  .service('socket', ['$scope', '$q', '$interval', 'cookieStore', function($scope, $q, $interval, cookie) {
    "use strict";
    var self = this;
    self.socket = null;
    self.connected = false;

    var timeout_count = 0;
    var timeout_callbacks = [];
    var timein_callbacks = [];
    var timeout_interval = null;
    var disconnect_callbacks = [];
    var connect_callbacks = [];
    var failure_callbacks = [];

    /** Registers callbacks to run when the socket has not seen activity
     *  in some while, and when messages are received after a timeout has passed.
     */
    self.register_timeout_callback = function(cb) {
      timeout_callbacks.push(cb);
    };
    self.register_timein_callback = function(cb) {
      timein_callbacks.push(cb);
    };
    /** Registers callbacks to run when the socket loses/gains connectivity. */
    self.register_disconnect_callback = function(cb) {
      disconnect_callbacks.push(cb);
    };
    self.register_connect_callback = function(cb) {
      connect_callbacks.push(cb);
    };
    /** Registers callback to run when the socket has run into an error. */
    self.register_fail_callback = function(cb) {
      failure_callbacks.push(cb);
    };

    /** Connects the socket, sets up the disconnection monitor. */ 
    self.connect = function () {
      self.socket = new SeashellWebsocket(sprintf("wss://%s:%d",cookie.get("creds").host, cookie.get("creds").port),
                                          cookie.get("creds").key,
                                          /** Failure - probably want to prompt the user to attempt to reconnect/
                                           *  log in again.
                                           */
                                          function () {
                                            /** Report connect failures as disconnections. */
                                            if (self.connected) {
                                              $scope.$apply(function () {
                                                $interval.stop(timeout_interval);
                                                _.each(failure_callbacks, call);
                                              });
                                            } else {
                                              $scope.apply(function () {
                                                $interval.stop(timeout_interval);
                                                _.each(disconnect_callbacks, call);});
                                            }
                                          },
                                          /** Socket closed - probably want to prompt the user to reconnect? */
                                          function () {
                                            self.connected = false;
                                            $scope.apply(function () {
                                              $interval.stop(timeout_interval);
                                              _.each(disconnect_callbacks, call);
                                            });
                                          });
      return $q.when(self.socket.ready)
        .then(function () {
          console.log("Seashell socket set up properly.");
          timeout_interval = $interval(function () {
            if (timeout_count++ === 3) {
              _.each(timeout_callbacks, call);
            }
            $q.when(self.socket.ping())
              .then(function () {
                if (timeout_count >= 3) {
                  _.each(timein_callbacks, call);
                }
                timeout_count = 0;
              });
          }, 4000);
          self.connected = true;
          console.log("Websocket disconnection monitor set up properly.");
          /** Run the callbacks. */
          _.each(connect_callbacks, call);
        });
    };
  }]);
