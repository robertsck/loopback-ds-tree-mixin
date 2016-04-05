var lo = require('lodash');

function Tree(Model, config) {
    Model.defineProperty('ancestors', {type: [{type: Object}], required: true});
    Model.defineProperty('parent', {type: Object, required: false});
    Model.defineProperty('children', {type: [{type: Object}], required: false});
    Model.defineProperty('depth', {type: Number, required: false});
    Model.defineProperty('orderBy', {type: Number, required: false});

    /**
     *
     * @param {object} parent
     * @param {object} options
     * @param {function} callback
     * @returns {*}
     */
    Model.asTree = function (parent, options, callback) {
        var ParentID;
        if (arguments.length == 3 && typeof arguments[1] == 'object'){
            callback = arguments[2];
        } else if (arguments.length == 3){
            callback = arguments[2];
            options = arguments[1] = {};
        } else if (arguments.length == 2){
            callback = arguments[1];
        }

        if (typeof parent == 'string') {//Hoping on an id
            ParentID = parent;
        } else if (typeof parent.id != 'undefined') {//this is the actual parent model
            ParentID = parent.id;
        } else if (typeof parent === 'object' && typeof parent.id == 'undefined') {//this is a query
            //we need to first find the actual id and then create a query
            return Model.findOne({where: parent})
                .then(function (Parent) {
                     return Model.find({where : {ancestors: Parent.id}})
                        .then(function (docs) {

                            var tree = toTree(docs,options);

                            if (options.withParent){
                                Parent.children = tree;
                                if (typeof callback == 'function'){
                                    callback(null,Parent);
                                }

                                return Parent;
                            }

                            if (typeof callback == 'function'){
                                callback(null,tree);
                            }

                            return tree;
                        })
                        .catch(handleErr);
                })
        }

        return Model.find({where: {ancestors: ParentID}})
            .then(function (docs) {
                var tree = toTree(docs,options);
                if (typeof callback == 'function'){
                    callback(null,tree);
                }
                return tree;
            })
            .catch(handleErr);
    };

    Model.addNode = function (Parent, node) {
        //if the Parent is a query instead of a model
        if (typeof Parent.where != 'undefined') {

        }

        Model.findOne({where: {permalink: 'f15a'}}).then(function (Parent) {
                Model.create({
                    category: 'a category',
                    ancestors: createAncestorsArray(Parent)
                }).then(function (res) {
                        console.log(res)
                    })
                    .catch(function (err) {
                        console.log(err)
                    })
            })
            .catch(function (err) {
                console.log(err.stack)
            });
    };

    function toTree(docs,options) {
        if (typeof options == 'undefined'){
            options = {};
        }

        var tree = lo.clone(docs),
            newTree = [],
            treeDepth = [];

        for (var i in tree) {
            if (!tree[i].ancestors) {
                tree[i].depth = 0;
                continue;
            }

            tree[i].depth = tree[i].ancestors.length;
            treeDepth.push(tree[i].depth);
        }

        //this is not a valid tree
        if (treeDepth.length == 0) {
            return docs;
        }

        tree = lo.sortBy(tree, 'depth');

        var maxDepth = lo.max(treeDepth),
            minDepth = lo.min(treeDepth);

        for (var i = 0; (maxDepth) >= i; i++) {
            var found = lo.filter(tree, {depth: i});

            if ((i) == minDepth) {
                for (var a in found) {
                    found[a].children = [];
                    newTree.push(found[a]);
                }
                continue;
            }

            for (var a in found) {
                var item = lo.find(tree, {id: found[a].parent});
                //format this item, add - remove - change properties
                if (typeof options.formatter == 'function'){
                    item = options.formatter(item);
                }
                
                if (item) {
                    if (!item.children) {
                        item.children = [];
                    }
                    item.children.push(found[a]);
                    item.children = lo.sortBy(item.children, 'orderBy');
                }
            }
        }

        return (options.returnEverything) ? {tree: newTree, flat: tree} : newTree;
    }

    function handleErr(err) {
        return err;
    }

    function createAncestorsArray(Parent) {
        var ancestors = [];
        //add existing ancestors first
        if (Parent.ancestors) {
            for (var i in Parent.ancestors) {
                if (typeof Parent.ancestors[i] == 'object') {
                    ancestors.push(Parent.ancestors[i]);
                }
            }
        }

        ancestors.push(Parent.id);
        return ancestors
    }

    Model.observe('before save', function event(ctx, next) {
        //add ancestors + parent if not there
        if (ctx.instance) { //update
            if (ctx.instance.id) {

            }
        }
        //create
    });

    Model.remoteMethod('asTree', {
        accepts: [{
            arg: 'parent',
            type: 'object',
            required: true,
            http: {
                source : 'query'
            }
        },
            {
                arg: 'options',
                type: 'object',
                required: false,
                http: {
                    source : 'query'
                }
            }],
        returns: {
            arg: 'result',
            type: 'string',
            root: true
        },
        http: {
            path: '/asTree',
            verb: 'get'
        }
    });
}

module.exports = function mixin(app) {
    app.loopback.modelBuilder.mixins.define('Tree', Tree);
};
