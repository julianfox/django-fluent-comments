(function($)
{
    var scrollElement = 'html, body';
    var activeInput = '';

    // Settings
    var COMMENT_SCROLL_TOP_OFFSET = 40;
    var PREVIEW_SCROLL_TOP_OFFSET = 20;
    var ENABLE_COMMENT_SCROLL = true;


    $.fn.ready(function()
    {
        var commentform = $('form.js-comments-form');
        if( commentform.length > 0 )
        {
            // Detect last active input.
            // Submit if return is hit, or any button other then preview is hit.
            commentform.find(':input').focus(setActiveInput).mousedown(setActiveInput);
            commentform.submit(onCommentFormSubmit);
        }

        // Bind event for show comments
        $('body').on('click', '.open-comments', function() {
            var $a = $(this);
            var comment_id = $a.attr('data-comment-id');

            toggleComments(comment_id);
        });

        // Bind event for confirm delete comment
        $('body').on("click", ".delete-comments", function(e) {
            var link = $(this).attr("href");
            e.preventDefault();    
            bootbox.confirm("Are you sure you want to delete this content?", function(result) {    
                if (result) {
                    document.location.href = link;     
                }    
            });

        });

        var $all_forms = $('.js-comments-form');
        $all_forms
          .each(function(){
            var $form = $(this);
            var object_id = parseInt($form.attr('data-object-id'));  // Supported in all jQuery versions.
            $form.wrap('<div class="js-comments-form-orig-position" id="comments-form-orig-position-' + object_id + '"></div>');
          });

        // HACK HACK HACK
        // Restore the parent-id when the server is unable to do so.
        // See if the comment-form can be found near to the current list of comments.
        var $all_comment_divs = $("div.comments");
        var $all_broken_comment_divs = $all_comment_divs.filter("#comments-None").add($all_comment_divs.filter('#comments-'));
        $all_broken_comment_divs.each(function(){
            var node = this.parentNode;
            for(var i = 0; i < 4; i++) {
                var $form = $(node).find('.js-comments-form');
                if($form.length) {
                    var target_object_id = parseInt($form.attr('data-object-id'));
                    if(target_object_id) {
                        $(this).attr('id', 'comments-' + target_object_id).attr('data-object-id', target_object_id);
                    }
                    break;
                }

                node = node.parentNode;
                if(! node) break;
            }
        });

        // Find the element to use for scrolling.
        // This code is much shorter then jQuery.scrollTo()
        $('html, body').each(function()
        {
            // See which tag updates the scrollTop attribute
            var $rootEl = $(this);
            var initScrollTop = $rootEl.attr('scrollTop');
            $rootEl.attr('scrollTop', initScrollTop + 1);
            if( $rootEl.attr('scrollTop') == initScrollTop + 1 )
            {
                scrollElement = this.nodeName.toLowerCase();
                $rootEl.attr('scrollTop', initScrollTop);  // Firefox 2 reset
                return false;
            }
        });


        // On load, scroll to proper comment.
        var hash = window.location.hash;
        if( hash.substring(0, 2) == "#c" )
        {
            var id = parseInt(hash.substring(2));
            if( ! isNaN(id))   // e.g. #comments in URL
                scrollToComment(id, 1000);
        }

    });

    function setActiveInput()
    {
        activeInput = this.name;
    }

    function onCommentFormSubmit(event)
    {
        event.preventDefault();  // only after ajax call worked.
        var form = event.target;

        ajaxComment(form, {
            onsuccess: onCommentPosted
        });
        return false;
    }

    function scrollToComment(id, speed)
    {        
        if( ! ENABLE_COMMENT_SCROLL ) {
            return;
        }
        
        // Allow initialisation before scrolling.
        var $comment = $("#c" + id);
        if( $comment.length == 0 ) {
            if( window.console ) console.warn("scrollToComment() - #c" + id + " not found.");
            return;
        }

        if( window.on_scroll_to_comment && window.on_scroll_to_comment({comment: $comment}) === false )
            return;

        // Display parent comments list if exist.
        var parent_comment_id = $comment.parent().parent().parent().children('.comment-item').attr('id').slice(1);
        if(parent_comment_id) {
            toggleComments(parent_comment_id);
        }

        // Scroll to the comment.
        scrollToElement( $comment, speed, COMMENT_SCROLL_TOP_OFFSET );
    }


    function scrollToElement( $element, speed, offset )
    {
        if( ! ENABLE_COMMENT_SCROLL ) {
            return;
        }
        
        if( $element.length )
            $(scrollElement).animate( {scrollTop: $element.offset().top - (offset || 0) }, speed || 1000 );
    }


    function onCommentPosted(comment_id, object_id, is_moderated, $comment, parent_id)
    {
        $('.no-comment').hide();

        if(parent_id) return;
        $('.add-feedback-success').find('.comment-link').attr('href', '#c'+comment_id);
        $('.add-feedback-form').hide();
        $('.add-feedback-success').show();
    }

    function toggleComments(comment_id) {
        var $a = $("[data-comment-id=" + comment_id + "]");
        var $comment = $a.closest('.comment-wrapper');
        var $commentList = $comment.children('.comment-list-wrapper');

        if($commentList.is(":visible")) {
            $commentList.find('.inline-comment-form').remove();
        } else {
            if(!$commentList.length) {
                $comment.append('<ul class="comment-list-wrapper"></ul>');
                $commentList = $comment.children('.comment-list-wrapper');
            }

            var $form = $('.inline-comment-form');
            var $commentForm = $('#feedback-form').clone();
            $commentForm.find(':input').focus(setActiveInput).mousedown(setActiveInput);
            $commentForm.submit(onCommentFormSubmit);
            $commentForm.find('textarea').attr('placeholder','Add a comment...');
            $commentForm.removeClass('hide');
            autosize($commentForm.find('textarea'));

            $commentList.append($commentForm);
            $($comment.find('#id_parent')[0]).val(comment_id);
        }

        $commentList.toggle();

    }

    function resetForm($form) {
        $($form[0].elements['comment']).val('');  // Wrapped in jQuery to silence errors for missing elements.
    }

    /*
      Based on django-ajaxcomments, BSD licensed.
      Copyright (c) 2009 Brandon Konkle and individual contributors.

      Updated to be more generic, more fancy, and usable with different templates.
     */
    function ajaxComment(form, args)
    {
        var onsuccess = args.onsuccess;

        if (form.commentBusy) {
            return false;
        }

        form.commentBusy = true;
        var $form = $(form);
        var comment = $form.serialize();
        var url = $form.attr('action') || './';
        var ajaxurl = $form.attr('data-ajax-action');

        $form.find('.submit-form').text('Posting...');

        // Use AJAX to post the comment.
        $.ajax({
            type: 'POST',
            url: ajaxurl || url,
            data: comment,
            dataType: 'json',
            success: function(data) {
                form.commentBusy = false;
                removeWaitAnimation($form);
                removeErrors($form);

                if (data.success) {
                    var $added;
                    $added = commentSuccess($form, data);

                    if(onsuccess)
                        args.onsuccess(data.comment_id, data.object_id, data.is_moderated, $added, data.parent_id);
                }
                else {
                    commentFailure(data);
                }
            },
            error: function(data) {
                form.commentBusy = false;
                removeWaitAnimation();

                // Submit as non-ajax instead
                //$form.unbind('submit').submit();
            }
        });

        return false;
    }

    function commentSuccess($form, data)
    {
        // Clean form
        resetForm($form);

        // Add comment
        var $new_comment = addComment(data);

        return $new_comment;
    }

    function addComment(data)
    {
        // data contains the server-side response.
        var $newCommentTarget = addCommentWrapper(data)
        $newCommentTarget.append(data['html']).removeClass('empty');
        return $("#c" + parseInt(data.comment_id));
    }

    function addCommentWrapper(data)
    {
        var parent_id = data['parent_id'];
        var object_id = data['object_id'];

        var $parent;
        if(parent_id) {
            $parent = $("#c" + parseInt(parent_id)).parent('li.comment-wrapper');
        }
        else {
            $parent = getCommentsDiv(object_id);
        }

        if(data['use_threadedcomments']) {
            // Each top-level of django-threadedcomments starts in a new <ul>
            // when you use the comment.open / comment.close logic as prescribed.
            var $commentUl = $parent.children('ul');

            if( $commentUl.length == 0 ) {
                var $form = $parent.children('.js-comments-form');

                if($form.length > 0) {
                    // Make sure to insert the <ul> before the comment form.
                    $form.before('<ul class="comment-list-wrapper"></ul>')
                    $commentUl = $parent.children('ul');
                }
                else {
                    $parent.append('<ul class="comment-list-wrapper"></ul>');
                    $commentUl = $parent.children('ul:last');
                }
            }

            if($commentUl.find('.inline-comment-form').length) {
                $('<li class="comment-wrapper"></li>').insertBefore($commentUl.find('.inline-comment-form'));
            } else {
                $commentUl.append($('<li class="comment-wrapper"></li>'));
            }

            // If not feedback increment comment count
            if(parent_id) {
                $commentCount = $parent.find('.open-comments-count');
                
                var commentCountNewValue = 1;
                if($commentCount.html() != "") {
                    commentCountNewValue = parseInt($commentCount.html(), 10)+1;
                }
                
                $commentCount.html(commentCountNewValue);

                if(commentCountNewValue > 1) {
                    $parent.find('.open-comments-text').html('Comments');
                } else {
                    $parent.find('.open-comments-text').html('Comment');
                }

            }

            return $commentUl.children('li:last');
        }
        else {
            return $parent;
        }
    }

    function commentFailure(data)
    {
        var form = $('form#comment-form-' + parseInt(data.object_id))[0];

        // Show mew errors
        for (var field_name in data.errors) {
            if(field_name) {
                var $field = $(form.elements[field_name]);

                // Twitter bootstrap style
                $field.closest('.control-group').addClass('error');
            }
        }
    }

    function removeErrors($form)
    {
        $form.find('.control-group.error').removeClass('error');
    }

    function getCommentsDiv(object_id)
    {
        var selector = "#comments-" + parseInt(object_id);
        var $comments = $(selector);
        if( $comments.length == 0 )
            alert("Internal error - unable to display comment.\n\nreason: container " + selector + " is missing in the page.");
        return $comments;
    }

    function removeWaitAnimation($form)
    {
        // Remove the wait message
        $form.find('.submit-form').text('submit');
    }

})(window.jQuery);
