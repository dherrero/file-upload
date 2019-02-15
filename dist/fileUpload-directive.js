(function () {
    'use strict';
	/**
	 * @ngdoc directive
	 * @autor Daniel Herrero https://github.com/dherrero
	 * @name file-upload
	 * @description file-upload: attribute directive for uploading files
	 * @param {string=} file-path, rest to upload file
	 * @param {string=} file-extensions, (in array format) indicating allowed file extensions to upload. Example: file-extensions="[jpg, png, gif, jpeg]"
	 * @param {string=} file-action, name of function into scope to execute before select a file from user device
	 * @param {string=} file-success, name of function into scope to execute after select a file from user device
	 * @param {string=} file-blob-response, if exists transform the MS response into blob file in that format. Example, MS response return pdf file. Set attributo like  file-blob-response = "application/pdf"
	 * @param {string=} file-params, add extra params to the request in JSON format.
	 * @param {string=} file-headers, add extra headers to the request in JSON format.
	 * @param {string=} file-event, event to listen to upload files (none to bind click, 'drop' to bind drop files into element, 'both' to bind both events)
	 * @example:
	<button class="btn btn-info" file-upload file-path="/upload" file-success="onFileUpload">Upload file</button>
	 */
    fileUpload.$inject = ['$log', '$window', '$translate', 'fileUploadConfig'];

    function fileUpload($log, $window, $translate, fileUploadConfig) {
        function extension(name) {
            var aux = name.split('.');
            return aux.length > 1 ? aux[aux.length - 1] : null;
        }
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                var input,
                    formFake,
                    filename,
                    files,
                    filePattern = '^[\\w\\-. ]+';

                var dropable = attr.fileEvent && (attr.fileEvent === 'drop' || attr.fileEvent === 'both');
                var clickable = !attr.fileEvent || (attr.fileEvent && attr.fileEvent === 'both');

                var extensions = [];

                if (attr.fileExtensions) {
                    attr.$observe('fileExtensions', function (val) {
                        extensions = val.match(/[a-z0-9]+/gs);
                    });
                }

                function removeForm() {
                    if (document.getElementById('formFileId')) {
                        var elemForm = document.getElementById("formFileId");
                        elemForm.parentNode.removeChild(elemForm);
                    }
                }

                function createForm() {
                    removeForm();
                    formFake = document.createElement('form');
                    formFake.setAttribute('action', '');
                    formFake.setAttribute('method', 'POST');
                    formFake.setAttribute('id', 'formFileId');
                    formFake.setAttribute('ectype', 'multipart/form-data');
                    formFake.style.opacity = "0";

                    input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('name', 'file');
                    input.setAttribute('id', 'fileField');
                    formFake.append(input);

                    document.body.append(formFake);

                    input.click();

                    input.onchange = function () {
                        files = document.getElementById("fileField").files;
                        onAttachFile();
                    };
                }

                function onAttachFile() {
                    if (checkFile()) {
                        if (attr.filePath) { //send file to path
                            uploadFile();
                        } else if (attr.fileAction) { //do action after attach file
                            var fileAction = (scope[attr.fileAction] || scope.$eval(attr.fileAction) || angular.noop);
                            if (angular.isFunction(fileAction)) {
                                fileAction(getFile());
                            }
                        }
                    }
                }

                function onSuccess(res) {
                    if (attr.fileSuccess) {
                        var returnFunc = (scope[attr.fileSuccess] || scope.$eval(attr.fileSuccess) || angular.noop);
                        if (angular.isFunction(returnFunc)) {
                            returnFunc(res);
                        } else {
                            throw new Error('Error in fileUpload directive: bad return function');
                        }
                    } else if (attr.fileBlobResponse) {
                        var file = new Blob([res], {
                            type: attr.fileBlobResponse
                        }),
                            fileURL = URL.createObjectURL(file);
                        $window.open(fileURL, filename);
                    }

                    if (res.indexOf('url') !== -1) {
                        var resp = angular.fromJson(res);
                        $window.open(resp.url);
                    } else if (res.url) {
                        $window.open(res.url);
                    }
                }

                function getFile() {
                    return files[0];
                }

                function addpoint(ext) {
                    return '.' + ext;
                }

                function checkFile() {
                    var file = getFile();
                    filename = file.name || '';
                    var ext = extension(filename);
                    var pattern = filePattern;
                    if (extensions instanceof Array && extensions.length) {
                        pattern += '(' + extensions.map(addpoint).join('|') + ')';
                    }
                    pattern += '$';
                    var regex = new RegExp(pattern);
                    if (!ext || filename.toLowerCase().search(regex) === -1) {
                        $translate('BAD_FILE_EXT').then(function (error) {
                            $log.error(error)
                        });
                        $translate('FILE_EXT_ADMITTED').then(function (error) {
                            var output = error;
                            output += ' ' + extensions.join(', ');
                            $log.error(output);
                        });
                        return false;
                    } else if (file.size > fileUploadConfig.max_file_upload) {
                        $log.error('MAX_FILE_SIZE'); // replace for toast message library
                        return false;
                    }
                    return true;
                }

                function uploadFile() {
                    var file = getFile();

                    var formData = new FormData();
                    formData.append("file", getFile());

                    if (attr.fileParams) {
                        var parameters = scope.$eval(attr.fileParams);
                        if (typeof parameters === 'object') {
                            angular.forEach(parameters, function (val, key) {
                                formData.append(key, val);
                            });
                        }
                    }

                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function () {
                        if (this.readyState >= 4) {
                            if (this.status >= 200 && this.status <= 208) {
                                onSuccess(this.response);
                            } else if (this.status === 409) {
                                var response = angular.fromJson(this.response),
                                    _msg = '';
                                if (response.errors) {
                                    angular.forEach(response.errors, function (value) {
                                        _msg += value + "\n";
                                    });
                                    $log.error(_msg); // replace for toast message library
                                }
                            }
                            // loading.stop('fileUpload'); //close custom block loader
                            removeForm();
                        }
                    };

                    xhr.open("POST", fileUploadConfig.back_rest + attr.filePath);
                    if (attr.fileHeaders) {
                        var headers = scope.$eval(attr.fileHeaders);
                        if (typeof headers === 'object') {
                            angular.forEach(headers, function (val, key) {
                                var value = scope.$eval(val);
                                xhr.setRequestHeader(key, value);
                            });
                        }
                    }

                    xhr.send(formData);
                    //  loading.start('fileUpload'); //open custom block loader

                }

                function highlight(e) {
                    element[0].classList.add('highlight')
                    e.preventDefault();
                }

                function unhighlight(e) {
                    element[0].classList.remove('highlight')
                    e.preventDefault();
                }

                function handleDrop(e) {
                    var dt = e.dataTransfer;
                    e.preventDefault();
                    files = dt.files;
                    onAttachFile();
                }

                function bindDrop() {
                    element[0].addEventListener('drop', handleDrop, false);

                    ['dragenter', 'dragover'].forEach(function (eventName) {
                        element[0].addEventListener(eventName, highlight, false)
                    });

                    ['dragleave', 'drop'].forEach(function (eventName) {
                        element[0].addEventListener(eventName, unhighlight, false)
                    });

                }

                function bindClick() {
                    element.bind('click', function (e) {
                        e.preventDefault();
                        createForm();
                    });
                }

                function init() {
                    if (dropable) {
                        bindDrop();
                    }
                    if (clickable) {
                        bindClick();
                    }
                }

                element.on('$destroy', function () {
                    if (dropable) {
                        ['dragenter', 'dragover'].forEach(function (eventName) {
                            element[0].removeEventListener(eventName)
                        });

                        ['dragleave', 'drop'].forEach(function (eventName) {
                            element[0].removeEventListener(eventName)
                        });
                    }
                    if (clickable) {
                        removeForm();
                    }
                });

                init();

            }
        };
    }

    angular.module('myFileUpload', ['pascalprecht.translate'])
        .config(['$translateProvider', function ($translateProvider) {

            $translateProvider.translations('en', {
                'BAD_FILE_EXT': 'Error: file type not supported',
                'FILE_EXT_ADMITTED': 'Allowed extensions'
            });

            $translateProvider.translations('es', {
                'BAD_FILE_EXT': 'Error: tipo de archivo no admitido',
                'FILE_EXT_ADMITTED': 'Extensiones permitidas'
            });

            $translateProvider.preferredLanguage('en');
        }
        ])
        .constant('fileUploadConfig', {
            max_file_upload: 500000, // 500kb
            back_rest: '/myServer'
        })
        .directive('fileUpload', fileUpload);

}());
