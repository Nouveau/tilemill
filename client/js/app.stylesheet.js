/**
 * Model: Stylesheet
 *
 * This model is *not* backed directly by the server.
 * It is a child model of Project and is saved serialized as part of the parent
 * Project model.
 */
var Stylesheet = Backbone.Model.extend({
    initialize: function() {
        if (!this.get('data')) {
            this.set({'data': ''});
        }
    },
    validate: function() {
        if (/^[a-z0-9\-_.]+$/i.test(this.id) === false) {
            return 'Name must contain only letters, numbers, dashes, underscores and periods.';
        }
    }
});

/**
 * Collection: StylesheetList
 *
 * This collection is *not* backed directly by the server.
 * This collection is a child of the Project model. When it is updated
 * (add/remove events) it updates the attributes of its parent model as well.
 */
var StylesheetList = Backbone.Collection.extend({
    model: Stylesheet,
    initialize: function(models, options) {
        var self = this;
        this.parent = options.parent;
        this.bind('add', function() {
            this.parent.set({ 'Stylesheet': self });
            this.parent.change();
        });
        this.bind('remove', function() {
            this.parent.set({ 'Stylesheet': self });
            this.parent.change();
        });
    },
});

/**
 * View: StylesheetListView
 *
 * Display a StylesheetList collection as a set of tabs.
 */
var StylesheetListView = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render', 'add', 'activate');
        var self = this;
        this.collection.bind('add', this.render);
        this.collection.bind('add', this.activate);
        this.collection.bind('remove', this.render);
        this.collection.bind('remove', this.activate);
        window.app.bind('ready', this.activate);
        this.render();
        /*
        @TODO: bind re-render to project events.
        */
    },
    render: function() {
        // Render the stylesheets wrapper if not present.
        if ($(this.el).has('.stylesheets').length === 0) {
            $(this.el).html(ich.StylesheetListView());
            $('.stylesheets', this.el).sortable({
                axis: 'x',
                revert: true,
                containment: 'parent'
                // @TODO: proper event.
                // change: TileMill.project.changed
            });
        }

        // Add a tab view for each stylesheet.
        var self = this;
        this.collection.each(function(stylesheet) {
            if (!stylesheet.view) {
                stylesheet.view = new StylesheetTabView({
                    model: stylesheet,
                    list: self
                });
                $('.stylesheets', self.el).append(stylesheet.view.el);
                self.activeTab = self.activeTab || stylesheet.view;
            }
        });
        return this;
    },
    activate: function() {
        if (this.activeTab) {
            this.activeTab.activate();
        }
    },
    events: {
        'click .tab-add': 'add'
    },
    add: function() {
        new StylesheetPopupView({collection: this.collection});
        return false;
    }
});

/**
 * View: StylesheetTabView
 *
 * Display a Stylesheet as a tab within a StylesheetListView.
 */
var StylesheetTabView = Backbone.View.extend({
    tagName: 'a',
    className: 'tab',
    initialize: function (params) {
        _.bindAll(this, 'render', 'update', 'delete', 'activate', 'remove');

        // Bind an update event that stores the codemirror input contents with
        // the Stylesheet model whenever the project model validate event
        // occurs, indicating that a save/sync is imminent.
        this.model.collection.parent.bind('validate', this.update);

        this.list = params.list;
        this.input = $(ich.StylesheetTabEditor());
        this.codemirror = false;
        this.render();
    },
    render: function () {
        $(this.el).html(ich.StylesheetTabView({ id: this.model.get('id') }));
        $('#editor', this.list.el).append(this.input);
        var colorPicker = new ColorPickerToolView();
        var colorSwatches = new ColorSwatchesToolView();
        var fontPicker = new FontPickerToolView({model: new Abilities, parent: this});
        this.list.$('#tools').append(colorPicker.el);
        this.list.$('#tools').append(fontPicker.el);
        this.list.$('#tools').append(colorSwatches.el);
        return this;
    },
    events: {
        'click .name': 'activate',
        'click .tab-delete': 'delete',
    },
    activate: function() {
        var self = this;

        $('#tabs .tab, #editor .editor', this.list.el).removeClass('active');
        $(this.el).addClass('active');
        $(this.input).addClass('active');
        this.list.activeTab = this;
        if (!this.codemirror) {
            this.codemirror = CodeMirror.fromTextArea($('textarea', this.input).get(0), {
                content: this.model.get('data'),
                height: '100%',
                stylesheet: 'css/code.css',
                path: 'js/codemirror/js/',
                parserfile: 'parsemss.js',
                parserConfig: window.data.reference,
                saveFunction: function() {
                    self.model.collection.parent.view.saveProject();
                },
                onChange: function() {
                    self.model.collection.parent.change();
                    // @TODO need an event that the color picker (and other
                    // editor "plugins" can bind to.
                },
                initCallback: function(cm) {
                    // @TODO need an event that the color picker (and other
                    // editor "plugins" can bind to.
                },
            });
        }
    },
    delete: function() {
        window.app.loading();
        if (confirm('Are you sure you want to delete this stylesheet?')) {
            this.list.collection.remove(this.model);
            this.remove();
            window.app.done();
        }
        else {
            window.app.done();
        }
        return false;
    },
    update: function() {
        if (this.codemirror) {
            this.model.set({'data': this.codemirror.getCode()});
        }
    },
    /**
     * Override of .remove(). Removes the input editor element as well.
     */
    remove: function() {
        $(this.el).remove();
        $(this.input).remove();
        return this;
    },
});

var ColorPickerToolView = Backbone.View.extend({
    id: 'color-picker',
    className: 'pane',
    events: {
        'click a.color-picker': 'showPicker'
    },
    initialize: function() {
        _.bindAll(this, 'activate', 'showPicker');
        this.render();
        window.app.bind('ready', this.activate);
    },
    render: function() {
        $(this.el).html(ich.ColorPickerToolView);
    },
    activate: function() {
        this.$('#farbtastic').farbtastic({
            callback: 'input#color',
            width: 200,
            height: 200
        });
    },
    showPicker: function() {
        this.$('#farbtastic').toggle('fast');
        return false;
    }
});

var ColorSwatchesToolView = Backbone.View.extend({
    id: 'color-swatches',
    initialize: function() {
        this.render();
    },
    render: function() {
        $(this.el).html(ich.ColorSwatchesToolView);
    }
});

var FontPickerToolView = Backbone.View.extend({
    id: 'font-picker',
    events: {
        'change #fonts-list': 'insertFont'
    },
    initialize: function(options) {
        _.bindAll(this, 'render', 'insertFont');
        this.model.fetch({ success: this.render, error: this.render});
        this.parent = options.parent;
    },
    render: function() {
        $(this.el).html(ich.FontPickerToolView({ fonts: this.model.get('fonts') }));
    },
    insertFont: function() {
        var mirror = this.parent.codemirror;
        mirror.insertIntoLine(
          mirror.cursorPosition().line,
          mirror.cursorPosition().character, '"' + this.$('select').val() + '"');
    }
});

/**
 * View: StylesheetPopupView
 *
 * Popup form for adding a new stylesheet.
 */
var StylesheetPopupView = PopupView.extend({
    events: _.extend(PopupView.prototype.events, {
        'click input.submit': 'submit',
    }),
    initialize: function(params) {
        this.options.title = 'Add stylesheet';
        this.options.content = ich.StylesheetPopupView({}, true);
        this.render();
    },
    submit: function() {
        var id = $('input.text', this.el).val();
        var stylesheet = new Stylesheet({id: id});
        var error = stylesheet.validate();
        if (error) {
            window.app.message('Error', error);
        }
        else {
            this.collection.add(stylesheet);
            this.remove();
        }
        return false;
    }
});
